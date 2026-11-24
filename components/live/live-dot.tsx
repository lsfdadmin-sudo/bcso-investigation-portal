"use client";

import type { LiveStatus } from "@/components/live/use-live-stream";
import { cn } from "@/lib/utils";

export function LiveDot({ status }: { status: LiveStatus }) {
  const live = status === "live";
  const label = live ? "LIVE" : status === "connecting" ? "LINKING" : "OFFLINE";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-obsidian/80 px-2 py-1 font-mono text-[10px] tracking-[0.16em] text-fog"
      title={live ? "Live updates connected" : status === "connecting" ? "Connecting to live updates" : "Live updates interrupted. Retrying."}
      aria-live="polite"
    >
      <span className="relative flex h-1.5 w-1.5">
        {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-emerald opacity-70" /> : null}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            live ? "bg-status-emerald" : status === "connecting" ? "bg-status-amber" : "bg-status-crimson",
          )}
        />
      </span>
      {label}
    </span>
  );
}
