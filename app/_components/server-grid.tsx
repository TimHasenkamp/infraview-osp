"use client";

import { ServerCard } from "./server-card";
import type { Server } from "../_lib/types";

interface ServerGridProps {
  servers: Server[];
}

export function ServerGrid({ servers }: ServerGridProps) {
  if (servers.length === 0) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
