"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateMockHistory } from "../_lib/mock-data";
import { TIME_RANGES } from "../_lib/constants";

interface MetricChartProps {
  serverId: string;
}

export function MetricChart({ serverId }: MetricChartProps) {
  const [range, setRange] = useState("1h");

  const data = useMemo(() => {
    const hours = TIME_RANGES.find((r) => r.value === range)?.seconds ?? 3600;
    return generateMockHistory(hours / 3600);
  }, [range]);

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        time: new Date(d.timestamp * 1000).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          ...(range === "7d" ? { day: "2-digit", month: "2-digit" } : {}),
        }),
      })),
    [data, range]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">System Metrics</CardTitle>
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
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value) => [
                  `${Number(value).toFixed(1)}%`,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", fontFamily: "monospace" }}
              />
              <Area
                type="monotone"
                dataKey="cpu_percent"
                name="CPU"
                stroke="#10b981"
                fill="url(#cpuGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="memory_percent"
                name="RAM"
                stroke="#f59e0b"
                fill="url(#memGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="disk_percent"
                name="Disk"
                stroke="#6366f1"
                fill="url(#diskGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
