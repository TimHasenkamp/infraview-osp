"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertForm } from "../_components/alert-form";
import { AlertList } from "../_components/alert-list";
import type { AlertRule } from "../_lib/types";

const MOCK_RULES: AlertRule[] = [
  {
    id: 1,
    server_id: null,
    metric: "cpu_percent",
    operator: ">",
    threshold: 90,
    severity: "critical",
    notify_email: "admin@example.com",
    notify_webhook: null,
    enabled: true,
    cooldown_seconds: 300,
  },
  {
    id: 2,
    server_id: "db-prod2",
    metric: "memory_percent",
    operator: ">",
    threshold: 85,
    severity: "warning",
    notify_email: null,
    notify_webhook: null,
    enabled: true,
    cooldown_seconds: 600,
  },
  {
    id: 3,
    server_id: null,
    metric: "disk_percent",
    operator: ">",
    threshold: 80,
    severity: "warning",
    notify_email: "admin@example.com",
    notify_webhook: "https://hooks.slack.com/example",
    enabled: false,
    cooldown_seconds: 300,
  },
];

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>(MOCK_RULES);

  const handleCreate = (rule: Omit<AlertRule, "id">) => {
    const newRule: AlertRule = {
      ...rule,
      id: Math.max(0, ...rules.map((r) => r.id)) + 1,
    };
    setRules((prev) => [...prev, newRule]);
  };

  const handleToggle = (id: number, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r))
    );
  };

  const handleDelete = (id: number) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          </div>
          <AlertForm onSubmit={handleCreate} />
        </div>
        <AlertList rules={rules} onToggle={handleToggle} onDelete={handleDelete} />
      </main>
    </div>
  );
}
