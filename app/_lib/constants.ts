export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  // Derive from current browser location so the pre-built image works on any
  // domain without extra configuration. wss:// when served over HTTPS.
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/dashboard`;
  }
  return "ws://localhost:8000/ws/dashboard";
}

export const WS_URL = getWsUrl();

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
