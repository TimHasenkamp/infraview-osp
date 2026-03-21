"use client";

import { Play, Square, RotateCcw, MoreVertical, ArrowUpCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContainerLogs } from "./container-logs";
import { containerAction } from "../_lib/api-client";
import { toast } from "sonner";
import type { ContainerInfo } from "../_lib/types";

interface ContainerListProps {
  containers: ContainerInfo[];
  serverId: string;
}

const stateStyles: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  exited: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  restarting: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function ContainerList({ containers, serverId }: ContainerListProps) {
  const handleAction = async (containerId: string, action: string) => {
    try {
      await containerAction(serverId, containerId, action as "start" | "stop" | "restart");
      toast.success(`Container ${action} command sent`);
    } catch {
      toast.error(`Failed to ${action} container`);
    }
  };

  const updatesAvailable = containers.filter((c) => c.update_available).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Containers
          {updatesAvailable > 0 ? (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
              <ArrowUpCircle className="h-3 w-3 mr-1" />
              {updatesAvailable} update{updatesAvailable > 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              all up to date
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Image</TableHead>
              <TableHead className="text-xs">State</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-10">Logs</TableHead>
              <TableHead className="text-xs w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((container) => (
              <TableRow key={container.id} className="border-border/50">
                <TableCell className="font-medium text-sm">
                  {container.name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  <span className="flex items-center gap-1.5">
                    {container.image}
                    {container.update_available && (
                      <span title="Image update available">
                        <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs ${stateStyles[container.state] || ""}`}
                  >
                    {container.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {container.status}
                </TableCell>
                <TableCell>
                  <ContainerLogs
                    serverId={serverId}
                    containerId={container.id}
                    containerName={container.name}
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {container.state !== "running" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(container.id, "start")}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </DropdownMenuItem>
                      )}
                      {container.state === "running" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(container.id, "stop")}
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleAction(container.id, "restart")}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restart
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
