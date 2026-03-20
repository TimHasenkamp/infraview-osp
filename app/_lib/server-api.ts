import type { ServerResponse } from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function fetchServers(): Promise<ServerResponse[]> {
  const res = await fetch(`${BACKEND_URL}/api/servers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchServer(id: string): Promise<ServerResponse | null> {
  const res = await fetch(`${BACKEND_URL}/api/servers/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
