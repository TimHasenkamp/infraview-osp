"use client";

import { AlertTriangle, Bell, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertRule } from "../_lib/types";

interface AlertListProps {
  rules: AlertRule[];
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
}

const metricLabels: Record<string, string> = {
  cpu_percent: "CPU",
  memory_percent: "RAM",
  disk_percent: "Disk",
};

export function AlertList({ rules, onToggle, onDelete }: AlertListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Alert Rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No alert rules configured</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Metric</TableHead>
                <TableHead className="text-xs">Condition</TableHead>
                <TableHead className="text-xs">Severity</TableHead>
                <TableHead className="text-xs">Server</TableHead>
                <TableHead className="text-xs">Notify</TableHead>
                <TableHead className="text-xs">Enabled</TableHead>
                <TableHead className="text-xs w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} className="border-border/50">
                  <TableCell className="font-medium text-sm">
                    {metricLabels[rule.metric] || rule.metric}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {rule.operator} {rule.threshold}%
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rule.severity === "critical" ? "destructive" : "default"}
                      className="text-xs"
                    >
                      {rule.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.server_id || "All"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[
                      rule.notify_email ? "Email" : null,
                      rule.notify_webhook ? "Webhook" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => onToggle(rule.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
