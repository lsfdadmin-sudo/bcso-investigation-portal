export type CaseSignal = {
  caseId: string;
  at: string;
};

type Listener = (signal: CaseSignal) => void;

const globalForLive = globalThis as unknown as { bcsoLive?: Set<Listener> };
const listeners = globalForLive.bcsoLive ?? new Set<Listener>();
globalForLive.bcsoLive = listeners;

export function publishCase(caseId: string) {
  const signal: CaseSignal = { caseId, at: new Date().toISOString() };
  for (const listener of listeners) {
    try {
      listener(signal);
    } catch {
      /* a closed stream should not stop the others */
    }
  }
}

export function subscribeCases(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
