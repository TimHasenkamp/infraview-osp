"use client";

import { ArrowLeft, Cpu, MemoryStick, HardDrive, Clock } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { MetricGauge } from "./metric-gauge";
import type { Server } from "../_lib/types";
import { formatBytes, timeAgo } from "../_lib/utils";

interface ServerDetailProps {
  server: Server;
}

export function ServerDetail({ server }: ServerDetailProps) {
  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Clock className="h-4 w-4" />
              Uptime
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {timeAgo(server.first_seen).replace(" ago", "")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
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
