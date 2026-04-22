"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "../_lib/utils";
import type { AlertEvent } from "../_lib/types";

export function ServerAlerts({ serverId }: { serverId: string }) {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/proxy/alerts/events?server_id=${serverId}&limit=50`)
      .then((r) => r.json())
      .then((d) => setEvents(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  const handleAck = async (id: number) => {
    await fetch(`/api/proxy/alerts/events/${id}/acknowledge`, { method: "POST" });
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, acknowledged: true } : e));
  };

  const handleResolve = async (id: number) => {
    await fetch(`/api/proxy/alerts/events/${id}/resolve`, { method: "POST" });
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, resolved: true } : e));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Alert Events</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alert events for this server.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Severity</TableHead>
                <TableHead className="text-xs">Message</TableHead>
                <TableHead className="text-xs">Fired</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id} className="border-border/50">
                  <TableCell>
                    {event.resolved ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : event.acknowledged ? (
                      <Clock className="h-4 w-4 text-amber-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${
                      event.severity === "critical"
                        ? "border-red-500/40 bg-red-950/50 text-red-400"
                        : "border-amber-500/40 bg-amber-950/50 text-amber-400"
                    }`}>
                      {event.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-sm truncate">
                    {event.message}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" suppressHydrationWarning>
                    {timeAgo(event.fired_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!event.acknowledged && !event.resolved && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleAck(event.id)}>
                          Ack
                        </Button>
                      )}
                      {!event.resolved && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleResolve(event.id)}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
