"use client";

import Link from "next/link";
import { Cpu, MemoryStick, HardDrive, Container } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { MetricGauge } from "./metric-gauge";
import type { Server } from "../_lib/types";

interface ServerCardProps {
  server: Server;
}

export function ServerCard({ server }: ServerCardProps) {
  const runningContainers = server.containers.filter(
    (c) => c.state === "running"
  ).length;

  return (
    <Link href={`/servers/${server.id}`}>
      <Card className="transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold tracking-tight group-hover:text-primary transition-colors">
              {server.hostname}
            </CardTitle>
            <StatusBadge status={server.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Container className="h-3 w-3" />
            <span>
              {runningContainers}/{server.containers.length} containers
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetricGauge
            label="CPU"
            value={server.cpu.usage_percent}
            icon={<Cpu className="h-3.5 w-3.5" />}
          />
          <MetricGauge
            label="RAM"
            value={server.memory.usage_percent}
            icon={<MemoryStick className="h-3.5 w-3.5" />}
          />
          <MetricGauge
            label="Disk"
            value={server.disk.usage_percent}
            icon={<HardDrive className="h-3.5 w-3.5" />}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
