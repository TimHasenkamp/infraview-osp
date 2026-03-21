"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "../_lib/constants";

interface UptimeData {
  uptime_percent: number;
  period_days: number;
  daily: { date: string; uptime_percent: number }[];
}

interface UptimePanelProps {
  serverId: string;
}

function getBarColor(pct: number): string {
  if (pct >= 99) return "bg-emerald-400";
  if (pct >= 95) return "bg-amber-400";
  if (pct > 0) return "bg-red-400";
  return "bg-muted";
}

export function UptimePanel({ serverId }: UptimePanelProps) {
  const [data, setData] = useState<UptimeData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/servers/${serverId}/uptime?days=30`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [serverId]);

  if (!data) return null;

  const last30 = data.daily.slice(-30);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Uptime
          </CardTitle>
          <span className={`text-lg font-bold font-mono ${
            data.uptime_percent >= 99 ? "text-emerald-400" :
            data.uptime_percent >= 95 ? "text-amber-400" : "text-red-400"
          }`}>
            {data.uptime_percent}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-px h-8">
          {last30.map((day) => (
            <div
              key={day.date}
              className={`flex-1 rounded-sm min-w-[3px] ${getBarColor(day.uptime_percent)}`}
              style={{ height: `${Math.max(10, day.uptime_percent)}%` }}
              title={`${day.date}: ${day.uptime_percent}%`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </CardContent>
    </Card>
  );
}
