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

export interface NetworkMetrics {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

export interface LoadMetrics {
  load1: number;
  load5: number;
  load15: number;
}

export interface PackageUpdate {
  name: string;
  current_version: string;
  new_version: string;
  security: boolean;
}

export interface UpdatesInfo {
  available: number;
  security: number;
  packages: PackageUpdate[];
  last_check: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  mem_percent: number;
  mem_bytes: number;
  user: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: "running" | "exited" | "paused" | "restarting";
  status: string;
  created: number;
  update_available?: boolean;
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
  network: NetworkMetrics;
  load: LoadMetrics;
  tags: string[];
  containers: ContainerInfo[];
}

export interface ServerResponse {
  id: string;
  hostname: string;
  status: "online" | "offline";
  last_seen: number;
  first_seen: number;
  cpu: CPUMetrics | null;
  memory: MemoryMetrics | null;
  disk: DiskMetrics | null;
  network: NetworkMetrics | null;
  load: LoadMetrics | null;
  tags: string[];
  containers: ContainerInfo[];
}

export interface MetricSnapshot {
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  net_bytes_sent: number;
  net_bytes_recv: number;
  load1: number;
  load5: number;
  load15: number;
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
  acknowledged_at: number | null;
  resolved: boolean;
  resolved_at: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type PaginatedMetrics = PaginatedResponse<MetricSnapshot>;
export type PaginatedAlertEvents = PaginatedResponse<AlertEvent>;

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
