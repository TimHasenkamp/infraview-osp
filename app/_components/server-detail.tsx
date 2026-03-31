"use client";

import { ArrowLeft, Cpu, MemoryStick, HardDrive, Clock, Network, Gauge } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { MetricGauge } from "./metric-gauge";
import { AgentUpdateButton } from "./agent-update-button";
import { useWSContext } from "../_providers/websocket-provider";
import type { Server } from "../_lib/types";
import { formatBytes, timeAgo } from "../_lib/utils";

interface ServerDetailProps {
  server: Server;
}

export function ServerDetail({ server: initialServer }: ServerDetailProps) {
  const { servers: wsUpdates } = useWSContext();
  const update = wsUpdates.get(initialServer.id);

  const server = update
    ? {
        ...initialServer,
        status: "online" as const,
        cpu: { ...initialServer.cpu, usage_percent: update.cpu_percent },
        memory: { ...initialServer.memory, usage_percent: update.memory_percent },
        disk: { ...initialServer.disk, usage_percent: update.disk_percent },
        network: { bytes_sent: update.net_bytes_sent, bytes_recv: update.net_bytes_recv, packets_sent: initialServer.network.packets_sent, packets_recv: initialServer.network.packets_recv },
        load: { load1: update.load1, load5: update.load5, load15: update.load15 },
        containers: update.containers ?? initialServer.containers,
      }
    : initialServer;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {server.hostname}
            </h1>
            <StatusBadge status={server.status} />
          </div>
        </div>
        {server.status === "online" && (
          <AgentUpdateButton serverId={server.id} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={<Cpu className="h-4 w-4" />}
          label="CPU"
          value={server.cpu.usage_percent}
          detail={`${server.cpu.core_count} Cores`}
        />
        <MetricCard
          icon={<MemoryStick className="h-4 w-4" />}
          label="RAM"
          value={server.memory.usage_percent}
          detail={`${formatBytes(server.memory.used_bytes)} / ${formatBytes(server.memory.total_bytes)}`}
        />
        <MetricCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Disk"
          value={server.disk.usage_percent}
          detail={`${formatBytes(server.disk.used_bytes)} / ${formatBytes(server.disk.total_bytes)}`}
        />
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Network className="h-4 w-4" />
              Network
            </div>
            <p className="text-lg font-bold tabular-nums">{formatBytes(server.network.bytes_recv)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ↑ {formatBytes(server.network.bytes_sent)} / ↓ {formatBytes(server.network.bytes_recv)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Gauge className="h-4 w-4" />
              Load
            </div>
            <p className="text-lg font-bold tabular-nums">{server.load.load1.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {server.load.load1.toFixed(2)} / {server.load.load5.toFixed(2)} / {server.load.load15.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Clock className="h-4 w-4" />
              Uptime
            </div>
            <p className="text-lg font-bold tabular-nums" suppressHydrationWarning>
              {timeAgo(server.first_seen).replace(" ago", "")}
            </p>
            <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
              Last seen: {timeAgo(server.last_seen)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
          {icon}
          {label}
        </div>
        <MetricGauge label="" value={value} />
        <p className="text-xs text-muted-foreground mt-2">{detail}</p>
      </CardContent>
    </Card>
  );
}
