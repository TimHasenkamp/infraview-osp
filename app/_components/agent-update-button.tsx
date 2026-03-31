"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AgentUpdateButtonProps {
  serverId: string;
}

export function AgentUpdateButton({ serverId }: AgentUpdateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/servers/${serverId}/update-agent`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.detail ?? "Update command failed");
      } else {
        toast.info("Update command sent — watch status messages above", {
          description: `Agent: ${serverId}`,
        });
      }
    } catch {
      toast.error("Network error while sending update command");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleUpdate}
      disabled={loading}
      className="gap-2"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      Update Agent
    </Button>
  );
}
