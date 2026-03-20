"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertForm } from "../_components/alert-form";
import { AlertList } from "../_components/alert-list";
import { getAlerts, createAlert, updateAlert, deleteAlert } from "../_lib/api-client";
import { toast } from "sonner";
import type { AlertRule } from "../_lib/types";

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlerts()
      .then(setRules)
      .catch(() => toast.error("Failed to load alert rules"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (rule: Omit<AlertRule, "id">) => {
    try {
      const newRule = await createAlert(rule);
      setRules((prev) => [...prev, newRule]);
      toast.success("Alert rule created");
    } catch {
      toast.error("Failed to create alert rule");
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateAlert(id, { enabled });
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled } : r))
      );
    } catch {
      toast.error("Failed to update alert rule");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAlert(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Alert rule deleted");
    } catch {
      toast.error("Failed to delete alert rule");
    }
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
          <div className="flex items-center gap-2">
            <Link href="/alerts/events">
              <Button variant="outline" size="sm">
                Event History
              </Button>
            </Link>
            <AlertForm onSubmit={handleCreate} />
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <AlertList rules={rules} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </main>
    </div>
  );
}
