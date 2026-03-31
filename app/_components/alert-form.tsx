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
import type { AlertRule, NotifyChannel } from "../_lib/types";

interface AlertFormProps {
  onSubmit: (rule: Omit<AlertRule, "id">) => void;
}

const CHANNEL_LABELS: Record<NotifyChannel, string> = {
  none: "None",
  email: "Email",
  discord: "Discord",
  slack: "Slack",
  gotify: "Gotify",
  webhook: "Webhook (generic)",
};

export function AlertForm({ onSubmit }: AlertFormProps) {
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState("cpu_percent");
  const [threshold, setThreshold] = useState("90");
  const [severity, setSeverity] = useState("warning");
  const [channel, setChannel] = useState<NotifyChannel>("none");
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [gotifyToken, setGotifyToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      server_id: null,
      metric: metric as AlertRule["metric"],
      operator: ">",
      threshold: parseFloat(threshold),
      severity: severity as AlertRule["severity"],
      notify_email: channel === "email" ? email || null : null,
      notify_webhook: channel !== "none" && channel !== "email" ? webhookUrl || null : null,
      notify_channel: channel,
      gotify_token: channel === "gotify" ? gotifyToken || null : null,
      enabled: true,
      cooldown_seconds: 300,
    });
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setMetric("cpu_percent");
    setThreshold("90");
    setSeverity("warning");
    setChannel("none");
    setEmail("");
    setWebhookUrl("");
    setGotifyToken("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <Plus className="h-4 w-4" />
        New Rule
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
            <Label>Notification Channel</Label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as NotifyChannel)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {(Object.keys(CHANNEL_LABELS) as NotifyChannel[]).map((ch) => (
                <option key={ch} value={ch}>{CHANNEL_LABELS[ch]}</option>
              ))}
            </select>
          </div>

          {channel === "email" && (
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="alerts@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          {(channel === "discord" || channel === "slack" || channel === "webhook") && (
            <div className="space-y-2">
              <Label>
                {channel === "discord" && "Discord Webhook URL"}
                {channel === "slack" && "Slack Webhook URL"}
                {channel === "webhook" && "Webhook URL"}
              </Label>
              <Input
                type="url"
                placeholder={
                  channel === "discord"
                    ? "https://discord.com/api/webhooks/..."
                    : channel === "slack"
                    ? "https://hooks.slack.com/services/..."
                    : "https://your-server.com/webhook"
                }
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
              />
            </div>
          )}

          {channel === "gotify" && (
            <>
              <div className="space-y-2">
                <Label>Gotify Server URL</Label>
                <Input
                  type="url"
                  placeholder="https://gotify.example.com"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>App Token</Label>
                <Input
                  type="password"
                  placeholder="App token from Gotify"
                  value={gotifyToken}
                  onChange={(e) => setGotifyToken(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full">
            Create Rule
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
