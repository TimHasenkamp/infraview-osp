"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ServerCard } from "./server-card";
import { AddAgentDialog } from "./add-agent-dialog";
import { useWSContext } from "../_providers/websocket-provider";
import { ArrowUpDown } from "lucide-react";
import type { Server } from "../_lib/types";

type SortKey = "name" | "cpu" | "memory" | "status";

interface ServerGridProps {
  servers: Server[];
}

export function ServerGrid({ servers }: ServerGridProps) {
  const { servers: wsUpdates } = useWSContext();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("status");

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

  const filteredAndSorted = useMemo(() => {
    const filtered = activeTag
      ? mergedServers.filter((s) => s.tags.includes(activeTag))
      : mergedServers;

    return [...filtered].sort((a, b) => {
      // Online servers always first regardless of sort key
      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      switch (sortKey) {
        case "name":   return (a.display_name ?? a.hostname).localeCompare(b.display_name ?? b.hostname);
        case "cpu":    return b.cpu.usage_percent - a.cpu.usage_percent;
        case "memory": return b.memory.usage_percent - a.memory.usage_percent;
        default:       return (a.display_name ?? a.hostname).localeCompare(b.display_name ?? b.hostname);
      }
    });
  }, [mergedServers, activeTag, sortKey]);

  if (mergedServers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-4">
          <p className="text-lg">No servers connected</p>
          <p className="text-sm">Deploy the InfraView agent to start monitoring</p>
          <AddAgentDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {allTags.length > 0 && (
            <>
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
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowUpDown className="h-3 w-3" />
            {(["status", "name", "cpu", "memory"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`px-2 py-0.5 rounded capitalize transition-colors ${sortKey === key ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {key}
              </button>
            ))}
          </div>
          <AddAgentDialog />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSorted.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  );
}
