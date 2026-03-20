import { cookies } from "next/headers";
import type { ServerResponse } from "./types";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("infraview_token")?.value;
  if (token) {
    return { Cookie: `infraview_token=${token}` };
  }
  return {};
}

export async function fetchServers(): Promise<ServerResponse[]> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/servers`, { cache: "no-store", headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchServer(id: string): Promise<ServerResponse | null> {
  const headers = await authHeaders();
  const res = await fetch(`${BACKEND_URL}/api/servers/${id}`, { cache: "no-store", headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
