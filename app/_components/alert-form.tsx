"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { AlertRule, NotifyChannel } from "../_lib/types";

const CHANNELS: { value: NotifyChannel; label: string; icon: string }[] = [
  { value: "none",    label: "None",             icon: "—"  },
  { value: "email",   label: "Email",             icon: "✉"  },
  { value: "discord", label: "Discord",           icon: "🎮" },
  { value: "slack",   label: "Slack",             icon: "💬" },
  { value: "gotify",  label: "Gotify",            icon: "🔔" },
  { value: "webhook", label: "Webhook (generic)", icon: "🔗" },
];

interface AlertFormProps {
  onSubmit: (rule: Omit<AlertRule, "id">) => void;
  /** If provided, opens in edit mode pre-filled with this rule */
  rule?: AlertRule;
  /** Controlled open state for edit mode (list controls the trigger) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertForm({ onSubmit, rule, open: controlledOpen, onOpenChange }: AlertFormProps) {
  const isEdit = !!rule;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [metric, setMetric] = useState("cpu_percent");
  const [threshold, setThreshold] = useState("90");
  const [severity, setSeverity] = useState("warning");
  const [channel, setChannel] = useState<NotifyChannel>("none");
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [gotifyToken, setGotifyToken] = useState("");
  const [testState, setTestState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testError, setTestError] = useState("");

  // Sync fields when rule changes (edit mode) or dialog opens
  useEffect(() => {
    if (open && rule) {
      setMetric(rule.metric);
      setThreshold(String(rule.threshold));
      setSeverity(rule.severity);
      setChannel(rule.notify_channel ?? "none");
      setEmail(rule.notify_email ?? "");
      setWebhookUrl(rule.notify_webhook ?? "");
      setGotifyToken(rule.gotify_token ?? "");
      setTestState("idle");
      setTestError("");
    }
  }, [open, rule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      server_id: rule?.server_id ?? null,
      metric: metric as AlertRule["metric"],
      operator: ">",
      threshold: parseFloat(threshold),
      severity: severity as AlertRule["severity"],
      notify_email: channel === "email" ? email || null : null,
      notify_webhook: channel !== "none" && channel !== "email" ? webhookUrl || null : null,
      notify_channel: channel,
      gotify_token: channel === "gotify" ? gotifyToken || null : null,
      enabled: rule?.enabled ?? true,
      cooldown_seconds: rule?.cooldown_seconds ?? 300,
    });
    setOpen(false);
    if (!isEdit) resetForm();
  };

  const resetForm = () => {
    setMetric("cpu_percent");
    setThreshold("90");
    setSeverity("warning");
    setChannel("none");
    setEmail("");
    setWebhookUrl("");
    setGotifyToken("");
    setTestState("idle");
    setTestError("");
  };

  const sendTest = async () => {
    setTestState("loading");
    setTestError("");
    try {
      const res = await fetch("/api/proxy/alerts/test-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          notify_email: email || null,
          notify_webhook: webhookUrl || null,
          gotify_token: gotifyToken || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed");
      }
      setTestState("ok");
      setTimeout(() => setTestState("idle"), 3000);
    } catch (e) {
      setTestState("error");
      setTestError(e instanceof Error ? e.message : "Unknown error");
      setTimeout(() => setTestState("idle"), 4000);
    }
  };

  const canTest = channel !== "none" && (
    (channel === "email" && !!email) ||
    (channel === "gotify" && !!webhookUrl && !!gotifyToken) ||
    (["discord", "slack", "webhook"].includes(channel) && !!webhookUrl)
  );

  const trigger = isEdit ? null : (
    <DialogTrigger className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <Plus className="h-4 w-4" />
      New Rule
    </DialogTrigger>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v && !isEdit) resetForm(); }}>
      {trigger}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-2">
            <Label>Metric</Label>
            <Select value={metric} onValueChange={(v) => v && setMetric(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpu_percent">CPU %</SelectItem>
                <SelectItem value="memory_percent">Memory %</SelectItem>
                <SelectItem value="disk_percent">Disk %</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warning">⚠ Warning</SelectItem>
                <SelectItem value="critical">🔴 Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notification Channel</Label>
            <Select value={channel} onValueChange={(v) => v && setChannel(v as NotifyChannel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((ch) => (
                  <SelectItem key={ch.value} value={ch.value}>
                    <span className="flex items-center gap-2">
                      <span>{ch.icon}</span>
                      <span>{ch.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {channel === "discord" ? "Discord Webhook URL" : channel === "slack" ? "Slack Webhook URL" : "Webhook URL"}
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

          {channel !== "none" && (
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={!canTest || testState === "loading"}
                onClick={sendTest}
              >
                {testState === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
                {testState === "ok" && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                {testState === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                {testState === "idle" && <Send className="h-4 w-4" />}
                {testState === "loading" ? "Sending…" : testState === "ok" ? "Sent!" : testState === "error" ? "Failed" : "Send Test Notification"}
              </Button>
              {testState === "error" && testError && (
                <p className="text-xs text-destructive">{testError}</p>
              )}
              {!canTest && (
                <p className="text-xs text-muted-foreground">Fill in the fields above to enable the test.</p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full">
            {isEdit ? "Save Changes" : "Create Rule"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
