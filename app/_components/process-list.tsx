"use client";

import { Cpu } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWSContext } from "../_providers/websocket-provider";
import { formatBytes } from "../_lib/utils";
import type { ProcessInfo } from "../_lib/types";

interface ProcessListProps {
  processes: ProcessInfo[];
  serverId: string;
}

export function ProcessList({ processes: initialProcesses, serverId }: ProcessListProps) {
  const { servers: wsUpdates } = useWSContext();
  const update = wsUpdates.get(serverId);
  const processes = (update?.processes as ProcessInfo[] | undefined) ?? initialProcesses;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          Top Processes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {processes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No process data available</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs w-16">PID</TableHead>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs text-right w-20">CPU</TableHead>
                <TableHead className="text-xs text-right w-20">MEM</TableHead>
                <TableHead className="text-xs text-right w-24">RSS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((proc) => (
                <TableRow key={proc.pid} className="border-border/50">
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {proc.pid}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {proc.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {proc.user || "-"}
                  </TableCell>
                  <TableCell className={`text-sm text-right font-mono tabular-nums ${proc.cpu_percent > 50 ? "text-amber-400" : proc.cpu_percent > 80 ? "text-red-400" : ""}`}>
                    {proc.cpu_percent.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`text-sm text-right font-mono tabular-nums ${proc.mem_percent > 50 ? "text-amber-400" : proc.mem_percent > 80 ? "text-red-400" : ""}`}>
                    {proc.mem_percent.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono tabular-nums text-muted-foreground">
                    {formatBytes(proc.mem_bytes)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
