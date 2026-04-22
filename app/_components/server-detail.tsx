"use client";

import { ArrowLeft, Cpu, MemoryStick, HardDrive, Clock, Globe, Gauge, Pencil, Check, X, Copy } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
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
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(initialServer.display_name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const saveName = async () => {
    const trimmed = nameValue.trim();
    await fetch(`/api/proxy/servers/${initialServer.id}/display-name`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: trimmed }),
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setNameValue(initialServer.display_name ?? "");
    setEditing(false);
  };

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
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") cancelEdit(); }}
                  placeholder={server.hostname}
                  className="text-2xl font-bold tracking-tight bg-transparent border-b border-primary outline-none w-64"
                />
                <button onClick={saveName} className="text-emerald-400 hover:text-emerald-300"><Check className="h-4 w-4" /></button>
                <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/name">
                <h1 className="text-2xl font-bold tracking-tight">
                  {server.display_name ?? server.hostname}
                </h1>
                {server.display_name && (
                  <span className="text-sm text-muted-foreground font-normal">({server.hostname})</span>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="opacity-0 group-hover/name:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
          extra={server.disk.read_bytes_ps > 0 || server.disk.write_bytes_ps > 0
            ? `R ${formatBytes(server.disk.read_bytes_ps)}/s  W ${formatBytes(server.disk.write_bytes_ps)}/s`
            : undefined}
        />
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
              <Globe className="h-4 w-4" />
              Public IP
            </div>
            {server.public_ip ? (
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold tabular-nums font-mono">{server.public_ip}</p>
                <CopyIconButton value={server.public_ip} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
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
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
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

function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button
      onClick={copy}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="In Zwischenablage kopieren"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className="flex items-center gap-1 mt-2 group/copy">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs font-mono">{value}</span>
      <button
        onClick={copy}
        className="opacity-0 group-hover/copy:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-0.5"
        title={`Copy ${label}`}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  extra?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1.5">
          {icon}
          {label}
        </div>
        <MetricGauge label="" value={value} />
        <p className="text-xs text-muted-foreground mt-2">{detail}</p>
        {extra && <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">{extra}</p>}
      </CardContent>
    </Card>
  );
}
