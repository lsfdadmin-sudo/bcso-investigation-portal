"use client";

import { createContext, useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Emblem } from "@/components/brand/emblem";
import { evidenceCategoryLabel, suspectStatusClass, suspectStatusLabel } from "@/lib/constants";
import { formatWhen } from "@/lib/format";
import type { CaseEvent, GraphNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FlowData = {
  node?: GraphNode;
  event?: CaseEvent;
  evidenceCount?: number;
  expanded?: boolean;
  active?: boolean;
};

export type FlowNode = Node<FlowData, "case" | "suspect" | "evidence" | "related" | "event">;

export const GraphPerms = createContext({ canLink: false });

function Handles() {
  const { canLink } = useContext(GraphPerms);
  const positions = [
    ["t", Position.Top],
    ["b", Position.Bottom],
    ["l", Position.Left],
    ["r", Position.Right],
  ] as const;
  return (
    <>
      {positions.map(([id, position]) => (
        <Handle key={id} id={id} type="source" position={position} isConnectable={canLink} />
      ))}
    </>
  );
}

function Shell({
  selected,
  accent,
  children,
  label,
}: {
  selected: boolean;
  accent: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "w-[250px] overflow-hidden rounded-md border bg-[#121820] shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        selected ? "border-gold-bright" : "border-white/10",
      )}
      style={{ boxShadow: selected ? `inset 3px 0 0 ${accent}, 0 12px 40px rgba(0,0,0,0.35)` : `inset 3px 0 0 ${accent}` }}
    >
      {children}
      <Handles />
    </div>
  );
}

export function CaseFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node;
  if (!node || node.kind !== "case") return null;
  return (
    <Shell selected={selected} accent="#d4af37" label={`Case ${node.payload.caseNumber}`}>
      <div className="flex items-center gap-2 border-b border-white/6 px-3 py-2">
        <Emblem className="h-5 w-5" />
        <span className="font-mono text-[10px] tracking-[0.16em] text-gold">CASE</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="font-mono text-[11px] text-gold-bright">{node.payload.caseNumber}</div>
        <div className="mt-1 text-sm font-medium leading-5">{node.payload.incidentType}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-fog">{node.payload.location}</div>
      </div>
    </Shell>
  );
}

export function SuspectFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node;
  if (!node || node.kind !== "suspect") return null;
  const photo = node.photos[0];
  return (
    <Shell selected={selected} accent="#e5484d" label={`Suspect ${node.payload.name}`}>
      <div className="flex items-center justify-between border-b border-white/6 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-status-crimson">SUSPECT</span>
        <span
          className={cn(
            "inline-flex max-w-[9.5rem] truncate rounded-full border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
            suspectStatusClass(node.payload.status),
          )}
        >
          {suspectStatusLabel(node.payload.status)}
        </span>
      </div>
      <div className="flex gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{node.payload.name}</div>
          <div className="mt-1 truncate text-xs text-fog">{node.payload.alias ? `Alias ${node.payload.alias}` : "No alias"}</div>
        </div>
        {photo ? (
          // Evidence stills are served by the authenticated photo route.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${photo.id}`} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-white/10" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-white/5 text-[10px] text-fog">No photo</div>
        )}
      </div>
    </Shell>
  );
}

export function EvidenceFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node;
  if (!node || node.kind !== "evidence") return null;
  const photo = node.photos[0];
  return (
    <Shell selected={selected} accent="#3bc9db" label={`Evidence ${node.payload.tag}`}>
      <div className="flex items-center justify-between border-b border-white/6 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-signal-cyan">EVIDENCE</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-fog">{evidenceCategoryLabel(node.payload.category)}</span>
      </div>
      <div className="flex gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-signal-cyan">{node.payload.tag}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/90">{node.payload.description || "No description"}</div>
          {node.payload.findings ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-fog">{node.payload.findings}</p>
          ) : null}
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${photo.id}`} alt="" className="h-12 w-12 rounded object-cover ring-1 ring-white/10" />
        ) : null}
      </div>
    </Shell>
  );
}

export function RelatedFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node;
  if (!node || node.kind !== "related") return null;
  return (
    <Shell selected={selected} accent="#818cf8" label={`Related ${node.payload.title}`}>
      <div className="border-b border-white/6 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-signal-indigo">RELATED</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-medium">{node.payload.title}</div>
        <div className="mt-1 truncate text-xs text-fog">{node.payload.location || "Location not set"}</div>
      </div>
    </Shell>
  );
}

export function EventFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const event = data.event;
  if (!event) return null;
  const count = data.evidenceCount ?? 0;
  const open = Boolean(data.expanded);
  return (
    <Shell selected={selected || Boolean(data.active)} accent={open ? "#e0b84c" : "#d4af37"} label={`Event ${event.title}, ${count} evidence`}>
      <div className="flex items-center justify-between border-b border-white/6 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-gold">EVENT</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-fog">{event.eventType}</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="font-mono text-[10px] text-gold-bright">{formatWhen(event.occurredAt)}</div>
        <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">{event.title}</div>
        {event.findings ? <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-fog">{event.findings}</p> : null}
        <div className="mt-2 inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-bright">
          {count} evidence
        </div>
      </div>
      <div className="border-t border-white/6 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fog">
        {count === 0 ? "No evidence" : open ? "Evidence open" : "Evidence hidden"}
      </div>
    </Shell>
  );
}

export const nodeTypes = {
  case: CaseFlowNode,
  suspect: SuspectFlowNode,
  evidence: EvidenceFlowNode,
  related: RelatedFlowNode,
  event: EventFlowNode,
};
