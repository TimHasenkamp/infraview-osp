export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";

export const METRIC_COLORS = {
  cpu: "var(--chart-1)",
  memory: "var(--chart-2)",
  disk: "var(--chart-4)",
} as const;

export const METRIC_THRESHOLDS = {
  warning: 70,
  critical: 90,
} as const;

export const COLLECTION_INTERVAL_MS = 5000;

export const TIME_RANGES = [
  { label: "1h", value: "1h", seconds: 3600 },
  { label: "6h", value: "6h", seconds: 21600 },
  { label: "24h", value: "24h", seconds: 86400 },
  { label: "7d", value: "7d", seconds: 604800 },
  { label: "30d", value: "30d", seconds: 2592000 },
] as const;
