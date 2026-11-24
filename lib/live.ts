import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type CaseSignal = {
  caseId: string;
  at: string;
};

export type LiveKind = "case" | "status" | "responders" | "event" | "node" | "edge" | "photo" | "positions" | "ping";

export type LiveAction = "create" | "update" | "delete" | "refresh";

export type LiveEvent = {
  id: string;
  at: string;
  caseId: string | null;
  kind: LiveKind;
  action: LiveAction;
  clientId: string | null;
};

type Listener = (event: LiveEvent) => void;

type Bus = { listeners: Set<Listener> };

const globalForLive = globalThis as unknown as { bcsoLive?: Bus };

function bus(): Bus {
  const current = globalForLive.bcsoLive;
  if (!current || !(current.listeners instanceof Set)) {
    globalForLive.bcsoLive = { listeners: new Set() };
  }
  return globalForLive.bcsoLive as Bus;
}

const clientStore = new AsyncLocalStorage<{ clientId: string | null }>();

export function bindLiveClient<T>(clientId: string | null, fn: () => Promise<T> | T): Promise<T> | T {
  return clientStore.run({ clientId }, fn);
}

export function emitLive(event: {
  caseId: string | null;
  kind: Exclude<LiveKind, "ping">;
  action: Exclude<LiveAction, "refresh">;
}) {
  const full: LiveEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    caseId: event.caseId,
    kind: event.kind,
    action: event.action,
    clientId: clientStore.getStore()?.clientId ?? null,
  };
  for (const listener of bus().listeners) {
    try {
      listener(full);
    } catch {
      /* A dropped subscriber must not block the write that caused the event. */
    }
  }
}

export function subscribeLive(listener: Listener) {
  const listeners = bus().listeners;
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishCase(caseId: string) {
  emitLive({ caseId, kind: "case", action: "update" });
}

export function subscribeCases(listener: (signal: CaseSignal) => void) {
  return subscribeLive((event) => {
    if (!event.caseId) return;
    listener({ caseId: event.caseId, at: event.at });
  });
}

export function liveStreamResponse(filterCaseId: string | null) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const push = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const unsubscribe = subscribeLive((event) => {
        if (filterCaseId && event.caseId !== filterCaseId) return;
        push(`data: ${JSON.stringify(event)}\n\n`);
      });
      const ping = setInterval(() => {
        push(`data: ${JSON.stringify({ kind: "ping" })}\n\n`);
      }, 15000);
      function close() {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
      cleanup = close;
      push(`event: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
