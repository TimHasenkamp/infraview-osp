"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { AlertRule } from "../_lib/types";

interface AlertFormProps {
  onSubmit: (rule: Omit<AlertRule, "id">) => void;
}

export function AlertForm({ onSubmit }: AlertFormProps) {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState("cpu_percent");
  const [threshold, setThreshold] = useState("90");
  const [severity, setSeverity] = useState("warning");
  const [email, setEmail] = useState("");
  const [webhook, setWebhook] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      server_id: null,
      metric: metric as AlertRule["metric"],
      operator: ">",
      threshold: parseFloat(threshold),
      severity: severity as AlertRule["severity"],
      notify_email: email || null,
      notify_webhook: webhook || null,
      enabled: true,
      cooldown_seconds: 300,
    });
    setOpen(false);
    setMetric("cpu_percent");
    setThreshold("90");
    setSeverity("warning");
    setEmail("");
    setWebhook("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Alert Rule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Metric</Label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="cpu_percent">CPU %</option>
              <option value="memory_percent">Memory %</option>
              <option value="disk_percent">Disk %</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Threshold (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Severity</Label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Email (optional)</Label>
            <Input
              type="email"
              placeholder="alerts@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Webhook URL (optional)</Label>
            <Input
              type="url"
              placeholder="https://hooks.slack.com/..."
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Create Rule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
