"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getMetrics, getMetricsExportUrl } from "../_lib/api-client";
import { useWSContext } from "../_providers/websocket-provider";
import { Download } from "lucide-react";
import { formatBytes } from "../_lib/utils";
import { TIME_RANGES } from "../_lib/constants";
import type { MetricSnapshot } from "../_lib/types";

interface MetricChartProps {
  serverId: string;
}

const METRIC_SERIES = [
  { key: "cpu_percent", name: "CPU", color: "#00e5ff", unit: "%", default: true },
  { key: "memory_percent", name: "RAM", color: "#f59e0b", unit: "%", default: true },
  { key: "disk_percent", name: "Disk", color: "#7c8fff", unit: "%", default: true },
  { key: "load1", name: "Load 1m", color: "#ec4899", unit: "", default: false },
  { key: "load5", name: "Load 5m", color: "#f43f5e", unit: "", default: false },
  { key: "net_bytes_recv", name: "Net In", color: "#38bdf8", unit: "bytes", default: false },
  { key: "net_bytes_sent", name: "Net Out", color: "#818cf8", unit: "bytes", default: false },
] as const;

type SeriesKey = typeof METRIC_SERIES[number]["key"];

export function MetricChart({ serverId }: MetricChartProps) {
  const [range, setRange] = useState("1h");
  const [data, setData] = useState<MetricSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    () => new Set(METRIC_SERIES.filter((s) => s.default).map((s) => s.key))
  );

  const toggleSeries = useCallback((key: SeriesKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getMetrics(serverId, range, 5000)
      .then((result) => {
        if (!cancelled) {
          setData(result.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [serverId, range]);

  const { servers: wsUpdates } = useWSContext();
  const lastWsTimestamp = useRef(0);

  useEffect(() => {
    const update = wsUpdates.get(serverId);
    if (!update || loading) return;
    if (update.timestamp <= lastWsTimestamp.current) return;
    lastWsTimestamp.current = update.timestamp;

    const newPoint: MetricSnapshot = {
      timestamp: update.timestamp,
      cpu_percent: update.cpu_percent,
      memory_percent: update.memory_percent,
      disk_percent: update.disk_percent,
      net_bytes_sent: update.net_bytes_sent ?? 0,
      net_bytes_recv: update.net_bytes_recv ?? 0,
      load1: update.load1 ?? 0,
      load5: update.load5 ?? 0,
      load15: update.load15 ?? 0,
    };

    setData((prev) => {
      const rangeSeconds = TIME_RANGES.find((r) => r.value === range)?.seconds ?? 3600;
      const cutoff = update.timestamp - rangeSeconds;
      const trimmed = prev.filter((p) => p.timestamp >= cutoff);
      return [...trimmed, newPoint];
    });
  }, [wsUpdates, serverId, range, loading]);

  // Convert cumulative network counters to per-second rates
  const chartData = useMemo(() => {
    if (data.length < 2) return data;
    return data.map((point, i) => {
      if (i === 0) return { ...point, net_bytes_recv: 0, net_bytes_sent: 0 };
      const prev = data[i - 1];
      const dt = point.timestamp - prev.timestamp;
      if (dt <= 0) return { ...point, net_bytes_recv: 0, net_bytes_sent: 0 };
      return {
        ...point,
        net_bytes_recv: Math.max(0, (point.net_bytes_recv - prev.net_bytes_recv) / dt),
        net_bytes_sent: Math.max(0, (point.net_bytes_sent - prev.net_bytes_sent) / dt),
      };
    });
  }, [data]);

  const hasNetOrLoad = visible.has("net_bytes_recv") || visible.has("net_bytes_sent") || visible.has("load1") || visible.has("load5");
  const hasPercent = visible.has("cpu_percent") || visible.has("memory_percent") || visible.has("disk_percent");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTime = (label: any) => {
    const ts = Number(label);
    const d = new Date(ts * 1000);
    if (range === "7d" || range === "30d") {
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) +
        " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltipValue = (value: any, name: any) => {
    const v = Number(value);
    const series = METRIC_SERIES.find((s) => s.name === name);
    if (series?.unit === "bytes") return [`${formatBytes(v)}/s`, name];
    if (series?.unit === "%") return [`${v.toFixed(1)}%`, name];
    return [v.toFixed(2), name];
  };

  const activeSeries = METRIC_SERIES.filter((s) => visible.has(s.key));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">System Metrics</CardTitle>
          <div className="flex items-center gap-2">
            <a
              href={getMetricsExportUrl(serverId, range, "csv")}
              download
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Export CSV"
            >
              <Download className="h-3 w-3" />
              CSV
            </a>
            <Tabs value={range} onValueChange={setRange}>
              <TabsList className="h-8">
                {TIME_RANGES.map((r) => (
                  <TabsTrigger key={r.value} value={r.value} className="text-xs px-2.5 h-6">
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-2">
          {METRIC_SERIES.map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-mono transition-colors ${
                visible.has(s.key)
                  ? "border-transparent text-white"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={visible.has(s.key) ? { backgroundColor: s.color + "33", color: s.color, borderColor: s.color + "55" } : {}}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: visible.has(s.key) ? s.color : "#71717a" }}
              />
              {s.name}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : error ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Failed to load metrics
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No metric data available for this time range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} throttleDelay={50}>
                <defs>
                  {METRIC_SERIES.map((s) => (
                    <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatTime}
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={60}
                  scale="time"
                />
                <YAxis
                  yAxisId="percent"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  width={45}
                  hide={!hasPercent}
                />
                <YAxis
                  yAxisId="raw"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "#71717a" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const hasNet = visible.has("net_bytes_recv") || visible.has("net_bytes_sent");
                    if (hasNet) return `${formatBytes(v)}/s`;
                    return v.toFixed(1);
                  }}
                  width={55}
                  hide={!hasNetOrLoad}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f1a2e",
                    border: "1px solid #1e3a5f",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    padding: "8px 12px",
                  }}
                  labelFormatter={formatTime}
                  labelStyle={{ color: "#a1a1aa", marginBottom: "4px" }}
                  itemStyle={{ padding: "1px 0" }}
                  formatter={formatTooltipValue}
                  isAnimationActive={false}
                  cursor={{ stroke: "#71717a", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                {activeSeries.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    yAxisId={s.unit === "%" ? "percent" : "raw"}
                    stroke={s.color}
                    fill={`url(#gradient-${s.key})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#18181b" }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
