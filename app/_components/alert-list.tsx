"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Trash2, Pencil } from "lucide-react";
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
import { AlertForm } from "./alert-form";
import type { AlertRule } from "../_lib/types";

interface AlertListProps {
  rules: AlertRule[];
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, rule: Omit<AlertRule, "id">) => void;
}

const metricLabels: Record<string, string> = {
  cpu_percent: "CPU",
  memory_percent: "RAM",
  disk_percent: "Disk",
};

const channelIcons: Record<string, string> = {
  email: "✉",
  discord: "🎮",
  slack: "💬",
  gotify: "🔔",
  webhook: "🔗",
};

export function AlertList({ rules, onToggle, onDelete, onEdit }: AlertListProps) {
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  return (
    <>
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
                  <TableHead className="text-xs w-20"></TableHead>
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
                      {!rule.notify_channel || rule.notify_channel === "none" ? (
                        <span>—</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span>{channelIcons[rule.notify_channel] ?? "🔗"}</span>
                          <span className="capitalize">{rule.notify_channel}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => onToggle(rule.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingRule(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog — rendered outside the table to avoid nesting issues */}
      {editingRule && (
        <AlertForm
          rule={editingRule}
          open={!!editingRule}
          onOpenChange={(v) => { if (!v) setEditingRule(null); }}
          onSubmit={(updated) => {
            onEdit(editingRule.id, updated);
            setEditingRule(null);
          }}
        />
      )}
    </>
  );
}
