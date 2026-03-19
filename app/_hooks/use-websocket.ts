"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WSMessage } from "../_lib/types";
import { WS_URL } from "../_lib/constants";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setStatus("connected");
      attemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;
        setLastMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;

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
