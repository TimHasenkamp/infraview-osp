"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWSContext } from "../_providers/websocket-provider";
import { RefreshButton } from "./refresh-button";
import { timeAgo } from "../_lib/utils";
import type { UpdatesInfo } from "../_lib/types";

interface UpdatesPanelProps {
  serverId: string;
}

export function UpdatesPanel({ serverId }: UpdatesPanelProps) {
  const { servers: wsUpdates } = useWSContext();
  const [expanded, setExpanded] = useState(false);

  const handleRefresh = async () => {
    await fetch(`/api/proxy/servers/${serverId}/refresh-updates`, { method: "POST" });
  };

  const update = wsUpdates.get(serverId);
  const updates: UpdatesInfo | null = update?.updates ?? null;

  if (!update) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            System Updates
            <RefreshButton onRefresh={handleRefresh} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground animate-pulse">Connecting...</p>
        </CardContent>
      </Card>
    );
  }

  if (!updates || !updates.apt_available) {
    const msg = updates?.agent_mode === "container"
      ? "Container-Agent: nur Debian/Ubuntu-Hosts mit gemounteten APT-Verzeichnissen werden unterstützt. Für alle anderen Systeme bitte den nativen Agent als Binary installieren."
      : "Kein Paketmanager erkannt.";
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            System Updates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {updates?.os_name && (
            <p className="text-xs text-muted-foreground mb-2">OS: {updates.os_name}</p>
          )}
          <p className="text-sm text-muted-foreground">{msg}</p>
        </CardContent>
      </Card>
    );
  }

  const hasUpdates = updates.available > 0;
  const hasSecurity = updates.security > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {hasSecurity ? (
              <ShieldAlert className="h-4 w-4 text-red-400" />
            ) : hasUpdates ? (
              <ShieldAlert className="h-4 w-4 text-amber-400" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            )}
            System Updates
            <RefreshButton onRefresh={handleRefresh} />
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasUpdates ? (
              <>
                <Badge
                  variant="outline"
                  className={hasSecurity
                    ? "border-red-500/40 bg-red-950/50 text-red-400"
                    : "border-amber-500/40 bg-amber-950/50 text-amber-400"
                  }
                >
                  {updates.available} available
                </Badge>
                {hasSecurity && (
                  <Badge variant="outline" className="border-red-500/40 bg-red-950/50 text-red-400">
                    {updates.security} security
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/50 text-emerald-400">
                Up to date
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          {updates.os_name && (
            <p className="text-xs text-muted-foreground">OS: {updates.os_name}</p>
          )}
          {updates.last_check > 0 && (
            <p className="text-xs text-muted-foreground" suppressHydrationWarning>
              Last checked: {timeAgo(updates.last_check)}
            </p>
          )}
        </div>
        {hasUpdates && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} packages
            </button>
            {expanded && (
              <Table className="mt-3">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Package</TableHead>
                    <TableHead className="text-xs">Current</TableHead>
                    <TableHead className="text-xs">Available</TableHead>
                    <TableHead className="text-xs w-20">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updates.packages.map((pkg) => (
                    <TableRow key={pkg.name} className="border-border/50">
                      <TableCell className="text-sm font-mono font-medium">
                        {pkg.name}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {pkg.current_version}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-emerald-400">
                        {pkg.new_version}
                      </TableCell>
                      <TableCell>
                        {pkg.security ? (
                          <Badge variant="outline" className="text-xs border-red-500/40 bg-red-950/50 text-red-400">
                            security
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">regular</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
