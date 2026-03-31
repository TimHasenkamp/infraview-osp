"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth-provider";
import { useWebSocket } from "../_hooks/use-websocket";
import type { Server, ProcessInfo, UpdatesInfo } from "../_lib/types";

interface MetricUpdate {
  server_id: string;
  timestamp: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  net_bytes_sent: number;
  net_bytes_recv: number;
  load1: number;
  load5: number;
  load15: number;
  processes: ProcessInfo[];
  updates: UpdatesInfo | null;
  containers: Server["containers"];
}

interface AlertPayload {
  rule_id: number;
  server_id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: number;
}

interface WebSocketContextType {
  status: string;
  servers: Map<string, MetricUpdate>;
  lastAlert: AlertPayload | null;
  sendContainerAction: (serverId: string, containerId: string, action: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  status: "disconnected",
  servers: new Map(),
  lastAlert: null,
  sendContainerAction: () => {},
});

export function useWSContext() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { wsToken } = useAuth();
  const { status, lastMessage, sendMessage } = useWebSocket(wsToken);
  const [servers, setServers] = useState<Map<string, MetricUpdate>>(new Map());
  const [lastAlert, setLastAlert] = useState<AlertPayload | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "metric_update": {
        const update = lastMessage.payload as MetricUpdate;
        setServers((prev) => {
          const next = new Map(prev);
          next.set(update.server_id, update);
          return next;
        });
        break;
      }
      case "server_status": {
        const payload = lastMessage.payload as { server_id: string; status: string };
        if (payload.status === "offline") {
          setServers((prev) => {
            const next = new Map(prev);
            next.delete(payload.server_id);
            return next;
          });
        }
        break;
      }
      case "alert_event": {
        const alert = lastMessage.payload as AlertPayload;
        setLastAlert(alert);
        if (alert.severity === "critical") {
          toast.error(alert.message, { description: `Server: ${alert.server_id}` });
        } else {
          toast.warning(alert.message, { description: `Server: ${alert.server_id}` });
        }
        break;
      }
      case "agent_update_status": {
        const p = lastMessage.payload as { server_id: string; status: string; message: string };
        const desc = `Agent: ${p.server_id}`;
        if (p.status === "error") {
          toast.error(p.message, { description: desc });
        } else if (p.status === "up_to_date") {
          toast.success(p.message, { description: desc });
        } else {
          toast.info(p.message, { description: desc });
        }
        break;
      }
    }
  }, [lastMessage]);

  const sendContainerAction = useCallback(
    (serverId: string, containerId: string, action: string) => {
      sendMessage({
        type: "container_action",
        payload: { server_id: serverId, container_id: containerId, action },
      });
    },
    [sendMessage]
  );

  return (
    <WebSocketContext.Provider value={{ status, servers, lastAlert, sendContainerAction }}>
      {children}
    </WebSocketContext.Provider>
  );
}
