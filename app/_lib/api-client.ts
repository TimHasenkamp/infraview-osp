import { API_BASE_URL } from "./constants";
import type { Server, MetricSnapshot, AlertRule, AlertEvent, PaginatedMetrics, PaginatedAlertEvents } from "./types";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getServers(): Promise<Server[]> {
  return apiFetch<Server[]>("servers");
}

export async function getServer(id: string): Promise<Server> {
  return apiFetch<Server>(`servers/${id}`);
}

export async function getMetrics(
  serverId: string,
  range = "1h",
  limit = 500,
  offset = 0
): Promise<PaginatedMetrics> {
  return apiFetch<PaginatedMetrics>(
    `servers/${serverId}/metrics?range=${range}&limit=${limit}&offset=${offset}`
  );
}

export function getMetricsExportUrl(serverId: string, range = "1h", format: "csv" | "json" = "csv"): string {
  return `${API_BASE_URL}/servers/${serverId}/metrics/export?range=${range}&format=${format}`;
}

export async function containerAction(
  serverId: string,
  containerId: string,
  action: "start" | "stop" | "restart"
): Promise<void> {
  await apiFetch(`servers/${serverId}/containers/${containerId}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function getAlerts(): Promise<AlertRule[]> {
  return apiFetch<AlertRule[]>("alerts");
}

export async function createAlert(rule: Omit<AlertRule, "id">): Promise<AlertRule> {
  return apiFetch<AlertRule>("alerts", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export async function updateAlert(id: number, data: Partial<AlertRule>): Promise<AlertRule> {
  return apiFetch<AlertRule>(`alerts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAlert(id: number): Promise<void> {
  await apiFetch(`alerts/${id}`, { method: "DELETE" });
}

export async function getAlertEvents(
  limit = 50,
  offset = 0,
  serverId?: string,
  severity?: string
): Promise<PaginatedAlertEvents> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (serverId) params.set("server_id", serverId);
  if (severity) params.set("severity", severity);
  return apiFetch<PaginatedAlertEvents>(`alerts/events?${params}`);
}

export async function acknowledgeEvent(eventId: number): Promise<void> {
  await apiFetch(`alerts/events/${eventId}/acknowledge`, { method: "POST" });
}

export async function resolveEvent(eventId: number): Promise<void> {
  await apiFetch(`alerts/events/${eventId}/resolve`, { method: "POST" });
}

export async function getContainerLogs(
  serverId: string,
  containerId: string,
  lines = 100
): Promise<string> {
  const result = await apiFetch<{ logs: string; error?: string | null }>(
    `servers/${serverId}/containers/${containerId}/logs?lines=${lines}`
  );
  if (result.error) {
    throw new Error(result.error);
  }
  return result.logs;
}
