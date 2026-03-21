"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ServerCard } from "./server-card";
import { useWSContext } from "../_providers/websocket-provider";
import type { Server } from "../_lib/types";

interface ServerGridProps {
  servers: Server[];
}

export function ServerGrid({ servers }: ServerGridProps) {
  const { servers: wsUpdates } = useWSContext();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const mergedServers = useMemo(() => {
    return servers.map((server) => {
      const update = wsUpdates.get(server.id);
      if (!update) return server;
      return {
        ...server,
        status: "online" as const,
        cpu: { ...server.cpu, usage_percent: update.cpu_percent },
        memory: { ...server.memory, usage_percent: update.memory_percent },
        disk: { ...server.disk, usage_percent: update.disk_percent },
        network: { bytes_sent: update.net_bytes_sent, bytes_recv: update.net_bytes_recv, packets_sent: server.network.packets_sent, packets_recv: server.network.packets_recv },
        load: { load1: update.load1, load5: update.load5, load15: update.load15 },
        containers: update.containers ?? server.containers,
      };
    });
  }, [servers, wsUpdates]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    mergedServers.forEach((s) => s.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [mergedServers]);

  const filteredServers = activeTag
    ? mergedServers.filter((s) => s.tags.includes(activeTag))
    : mergedServers;

  if (mergedServers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-lg">No servers connected</p>
          <p className="text-sm">Deploy the InfraView agent to start monitoring</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={activeTag === null ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setActiveTag(null)}
          >
            All
          </Badge>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={activeTag === tag ? "default" : "outline"}
              className="cursor-pointer text-xs font-mono"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServers.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  );
}
