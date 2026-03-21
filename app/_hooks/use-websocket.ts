"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage } from "../_lib/types";
import { WS_URL } from "../_lib/constants";

const MAX_RECONNECT_ATTEMPTS = 20;

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "failed";

export function useWebSocket(wsToken: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attemptRef = useRef(0);
  const tokenRef = useRef(wsToken);
  tokenRef.current = wsToken;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!tokenRef.current) return;

    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

    const wsUrl = `${WS_URL}${WS_URL.includes("?") ? "&" : "?"}token=${tokenRef.current}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus("connected");
      attemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Ignore server ping messages
        if (data.type === "ping") return;
        setLastMessage(data as WSMessage);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;

      if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus("failed");
        return;
      }

      setStatus("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
      attemptRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastMessage, sendMessage };
}
