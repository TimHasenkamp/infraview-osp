import type { Server, MetricSnapshot } from "./types";

const now = Math.floor(Date.now() / 1000);

export const MOCK_SERVERS: Server[] = [
  {
    id: "web-prod8",
    hostname: "web-prod8",
    status: "online",
    last_seen: now,
    first_seen: now - 86400 * 30,
    cpu: {
      usage_percent: 34,
      core_count: 8,
      per_core: [28, 42, 31, 45, 22, 38, 35, 29],
    },
    memory: {
      usage_percent: 62,
      total_bytes: 17179869184,
      used_bytes: 10651629568,
      avail_bytes: 6528239616,
    },
    disk: {
      usage_percent: 45,
      total_bytes: 107374182400,
      used_bytes: 48318382080,
      free_bytes: 59055800320,
      path: "/",
    },
    containers: [
      { id: "c1a", name: "nginx", image: "nginx:1.25", state: "running", status: "Up 12 days", created: now - 86400 * 12 },
      { id: "c1b", name: "node-app", image: "node:20-alpine", state: "running", status: "Up 3 days", created: now - 86400 * 3 },
      { id: "c1c", name: "redis", image: "redis:7-alpine", state: "running", status: "Up 12 days", created: now - 86400 * 12 },
      { id: "c1d", name: "certbot", image: "certbot/certbot", state: "exited", status: "Exited (0) 2 hours ago", created: now - 86400 * 30 },
    ],
  },
  {
    id: "api-prod5",
    hostname: "api-prod5",
    status: "online",
    last_seen: now,
    first_seen: now - 86400 * 45,
    cpu: {
      usage_percent: 71,
      core_count: 4,
      per_core: [65, 78, 82, 59],
    },
    memory: {
      usage_percent: 84,
      total_bytes: 8589934592,
      used_bytes: 7215545958,
      avail_bytes: 1374388634,
    },
    disk: {
      usage_percent: 38,
      total_bytes: 53687091200,
      used_bytes: 20401094656,
      free_bytes: 33285996544,
      path: "/",
    },
    containers: [
      { id: "c2a", name: "fastapi-app", image: "python:3.12-slim", state: "running", status: "Up 5 days", created: now - 86400 * 5 },
      { id: "c2b", name: "postgres", image: "postgres:16", state: "running", status: "Up 14 days", created: now - 86400 * 14 },
      { id: "c2c", name: "pgbouncer", image: "pgbouncer:1.21", state: "running", status: "Up 14 days", created: now - 86400 * 14 },
    ],
  },
  {
    id: "db-prod2",
    hostname: "db-prod2",
    status: "online",
    last_seen: now,
    first_seen: now - 86400 * 90,
    cpu: {
      usage_percent: 22,
      core_count: 16,
      per_core: [18, 25, 15, 30, 20, 22, 19, 28, 16, 24, 21, 23, 17, 26, 20, 22],
    },
    memory: {
      usage_percent: 91,
      total_bytes: 34359738368,
      used_bytes: 31267377715,
      avail_bytes: 3092360653,
    },
    disk: {
      usage_percent: 67,
      total_bytes: 214748364800,
      used_bytes: 143881399322,
      free_bytes: 70866965478,
      path: "/",
    },
    containers: [
      { id: "c3a", name: "postgres-primary", image: "postgres:16", state: "running", status: "Up 30 days", created: now - 86400 * 30 },
      { id: "c3b", name: "postgres-replica", image: "postgres:16", state: "running", status: "Up 30 days", created: now - 86400 * 30 },
      { id: "c3c", name: "pgbackrest", image: "pgbackrest:2.48", state: "running", status: "Up 30 days", created: now - 86400 * 30 },
      { id: "c3d", name: "prometheus-exporter", image: "prom/postgres-exporter", state: "paused", status: "Paused", created: now - 86400 * 15 },
    ],
  },
];

export function generateMockHistory(hours: number = 1): MetricSnapshot[] {
  const points: MetricSnapshot[] = [];
  const intervalSeconds = hours <= 1 ? 5 : hours <= 6 ? 30 : hours <= 24 ? 120 : 600;
  const totalPoints = (hours * 3600) / intervalSeconds;
  const startTime = now - hours * 3600;

  let cpu = 30 + Math.random() * 20;
  let mem = 55 + Math.random() * 15;
  let disk = 40 + Math.random() * 10;

  for (let i = 0; i < totalPoints; i++) {
    cpu += (Math.random() - 0.48) * 5;
    cpu = Math.max(5, Math.min(98, cpu));
    mem += (Math.random() - 0.49) * 2;
    mem = Math.max(20, Math.min(98, mem));
    disk += (Math.random() - 0.5) * 0.3;
    disk = Math.max(10, Math.min(95, disk));

    points.push({
      timestamp: startTime + i * intervalSeconds,
      cpu_percent: Math.round(cpu * 10) / 10,
      memory_percent: Math.round(mem * 10) / 10,
      disk_percent: Math.round(disk * 10) / 10,
    });
  }

  return points;
}
