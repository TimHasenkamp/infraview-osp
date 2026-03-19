export interface CPUMetrics {
  usage_percent: number;
  core_count: number;
  per_core: number[];
}

export interface MemoryMetrics {
  usage_percent: number;
  total_bytes: number;
  used_bytes: number;
  avail_bytes: number;
}

export interface DiskMetrics {
  usage_percent: number;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  path: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "restarting";
  status: string;
  created: number;
}

export interface Server {
  id: string;
  hostname: string;
  status: "online" | "offline";
  last_seen: number;
  first_seen: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  containers: ContainerInfo[];
}

export interface MetricSnapshot {
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

export interface AlertRule {
  id: number;
  server_id: string | null;
  metric: "cpu_percent" | "memory_percent" | "disk_percent";
  operator: ">" | "<";
  threshold: number;
  severity: "warning" | "critical";
  notify_email: string | null;
  notify_webhook: string | null;
  enabled: boolean;
  cooldown_seconds: number;
}

export interface AlertEvent {
  id: number;
  rule_id: number;
  server_id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: "warning" | "critical";
  message: string;
  fired_at: number;
  acknowledged: boolean;
}

export type WSMessageType =
  | "initial_state"
  | "metric_update"
  | "server_status"
  | "alert_event"
  | "container_action";

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}
