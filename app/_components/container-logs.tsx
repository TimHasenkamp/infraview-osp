"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContainerLogs } from "../_lib/api-client";

interface ContainerLogsProps {
  serverId: string;
  containerId: string;
  containerName: string;
}

export function ContainerLogs({ serverId, containerId, containerName }: ContainerLogsProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    getContainerLogs(serverId, containerId, 200)
      .then((data) => {
        setLogs(data);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 50);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, serverId, containerId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <Terminal className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:!max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {containerName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              No logs available
            </div>
          ) : (
            <pre
              ref={scrollRef}
              className="bg-black/50 border border-border rounded-lg p-4 text-[11px] font-mono text-zinc-300 overflow-auto max-h-[75vh] leading-5 whitespace-pre"
            >
              {logs}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
