"use client";

import Link from "next/link";
import { Cpu, MemoryStick, HardDrive, Container, Globe, ArrowUpCircle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const containerUpdates = server.containers.filter((c) => c.update_available).length;
  const totalUpdates = containerUpdates + (server.updates_available ?? 0);
  const activeAlerts = server.active_alerts ?? 0;

  return (
    <Link href={`/servers/${server.id}`}>
      <Card className="transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-bold tracking-tight group-hover:text-primary transition-colors truncate">
              {server.display_name ?? server.hostname}
            </CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeAlerts > 0 && (
                <Badge variant="outline" className="gap-1 text-xs border-red-500/40 bg-red-950/50 text-red-400" title={`${activeAlerts} active alert(s)`}>
                  <Bell className="h-3 w-3" />
                  {activeAlerts}
                </Badge>
              )}
              {totalUpdates > 0 && (
                <Badge variant="outline" className="gap-1 text-xs border-amber-500/40 bg-amber-950/50 text-amber-400" title={`${totalUpdates} update(s) available`}>
                  <ArrowUpCircle className="h-3 w-3" />
                  {totalUpdates}
                </Badge>
              )}
              <StatusBadge status={server.status} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Container className="h-3 w-3" />
              {runningContainers}/{server.containers.length} containers
            </span>
            {server.public_ip && (
              <span className="flex items-center gap-1 font-mono">
                <Globe className="h-3 w-3" />
                {server.public_ip}
              </span>
            )}
          </div>
          {server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {server.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
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
