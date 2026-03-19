"use client";

import { cn } from "@/lib/utils";
import { getMetricColor, getMetricBarColor, formatPercent } from "../_lib/utils";

interface MetricGaugeProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

export function MetricGauge({ label, value, icon }: MetricGaugeProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn("font-bold tabular-nums", getMetricColor(value))}>
          {formatPercent(value)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", getMetricBarColor(value))}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
