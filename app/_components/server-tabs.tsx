"use client";

import { useState } from "react";
import { MetricChart } from "./metric-chart";
import { ContainerList } from "./container-list";
import { ImageManager } from "./image-manager";
import { ProcessList } from "./process-list";
import { UpdatesPanel } from "./updates-panel";
import { UptimePanel } from "./uptime-panel";
import { ServerAlerts } from "./server-alerts";
import type { ContainerInfo } from "../_lib/types";

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "containers", label: "Containers" },
  { key: "alerts",     label: "Alerts" },
] as const;

type Tab = (typeof TABS)[number]["key"];

interface ServerTabsProps {
  serverId: string;
  containers: ContainerInfo[];
}

export function ServerTabs({ serverId, containers }: ServerTabsProps) {
  const [active, setActive] = useState<Tab>("overview");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <div className="space-y-4">
          <UptimePanel serverId={serverId} />
          <MetricChart serverId={serverId} />
          <UpdatesPanel serverId={serverId} />
          <ProcessList processes={[]} serverId={serverId} />
        </div>
      )}

      {active === "containers" && (
        <div className="space-y-4">
          <ContainerList containers={containers} serverId={serverId} />
          <ImageManager serverId={serverId} />
        </div>
      )}

      {active === "alerts" && (
        <ServerAlerts serverId={serverId} />
      )}
    </div>
  );
}
