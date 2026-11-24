"use client";

import { useEffect, useRef, useState } from "react";
import { clientId } from "@/lib/client";

export type LiveStatus = "live" | "connecting" | "offline";

export type LiveMessage = {
  id?: string;
  at?: string;
  caseId?: string | null;
  kind?: string;
  action?: string;
  clientId?: string | null;
};

export function useLiveStream(url: string | null, onEvent: (event: LiveMessage) => void) {
  const [status, setStatus] = useState<LiveStatus>(url ? "connecting" : "offline");
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!url) return;
    let source: EventSource | null = null;
    let stopped = false;
    let retryTimer = 0;
    let pollTimer = 0;
    let delay = 1000;

    const connect = () => {
      if (stopped) return;
      setStatus((current) => (current === "live" ? current : "connecting"));
      source = new EventSource(url);
      source.onopen = () => {
        setStatus("live");
        delay = 1000;
        window.clearInterval(pollTimer);
        pollTimer = 0;
      };
      source.onmessage = (message) => {
        let event: LiveMessage;
        try {
          event = JSON.parse(message.data) as LiveMessage;
        } catch {
          return;
        }
        if (event.kind === "ping") return;
        if (event.clientId && event.clientId === clientId()) return;
        handler.current(event);
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (stopped) return;
        setStatus("offline");
        if (!pollTimer) {
          pollTimer = window.setInterval(() => {
            handler.current({ kind: "poll", action: "refresh", clientId: null });
          }, 8000);
        }
        retryTimer = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pollTimer);
      source?.close();
    };
  }, [url]);

  return status;
}
