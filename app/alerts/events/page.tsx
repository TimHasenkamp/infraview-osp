"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAlertEvents, acknowledgeEvent, resolveEvent } from "../../_lib/api-client";
import { toast } from "sonner";
import { timeAgo } from "../../_lib/utils";
import type { AlertEvent } from "../../_lib/types";

export default function AlertEventsPage() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const loadEvents = (offset: number) => {
    setLoading(true);
    getAlertEvents(pageSize, offset)
      .then((result) => {
        setEvents(result.items);
        setTotal(result.total);
      })
      .catch(() => toast.error("Failed to load alert events"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents(page * pageSize);
  }, [page]);

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeEvent(id);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, acknowledged: true, acknowledged_at: Date.now() / 1000 } : e
        )
      );
      toast.success("Alert acknowledged");
    } catch {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await resolveEvent(id);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, resolved: true, resolved_at: Date.now() / 1000 } : e
        )
      );
      toast.success("Alert resolved");
    } catch {
      toast.error("Failed to resolve alert");
    }
  };

  const openCount = events.filter((e) => !e.resolved).length;

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/alerts">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Alert Events</h1>
          </div>
          {openCount > 0 && (
            <Badge variant="outline" className="border-amber-500/40 bg-amber-950/50 text-amber-400">
              {openCount} open
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No alert events recorded
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Server</TableHead>
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
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            event.severity === "critical"
                              ? "border-red-500/40 bg-red-950/50 text-red-400"
                              : "border-amber-500/40 bg-amber-950/50 text-amber-400"
                          }`}
                        >
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{event.server_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {event.message}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" suppressHydrationWarning>
                        {timeAgo(event.fired_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!event.acknowledged && !event.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleAcknowledge(event.id)}
                            >
                              Ack
                            </Button>
                          )}
                          {!event.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleResolve(event.id)}
                            >
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
            {total > pageSize && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={(page + 1) * pageSize >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
