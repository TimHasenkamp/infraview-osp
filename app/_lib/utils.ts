export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function getMetricColor(value: number): string {
  if (value >= 90) return "text-destructive";
  if (value >= 70) return "text-amber-400";
  return "text-primary";
}

export function getMetricBarColor(value: number): string {
  if (value >= 90) return "bg-destructive";
  if (value >= 70) return "bg-amber-400";
  return "bg-primary";
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
