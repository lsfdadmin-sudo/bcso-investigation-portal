"use client";

import { createContext, useContext } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Emblem } from "@/components/brand/emblem";
import { evidenceCategoryLabel, suspectStatusLabel } from "@/lib/constants";
import type { GraphNode, SuspectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FlowNode = Node<{ node: GraphNode }, "case" | "suspect" | "evidence" | "related">;

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

function statusTone(status: SuspectStatus) {
  if (status === "at_large") return "text-status-crimson";
  if (status === "in_custody") return "text-status-emerald";
  if (status === "witness") return "text-signal-cyan";
  return "text-status-amber";
}

export function CaseFlowNode({ data, selected }: NodeProps<FlowNode>) {
  const node = data.node;
  if (node.kind !== "case") return null;
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
  if (node.kind !== "suspect") return null;
  const photo = node.photos[0];
  return (
    <Shell selected={selected} accent="#e5484d" label={`Suspect ${node.payload.name}`}>
      <div className="flex items-center justify-between border-b border-white/6 px-3 py-2">
        <span className="font-mono text-[10px] tracking-[0.16em] text-status-crimson">SUSPECT</span>
        <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", statusTone(node.payload.status))}>
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
  if (node.kind !== "evidence") return null;
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
  if (node.kind !== "related") return null;
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

export const nodeTypes = {
  case: CaseFlowNode,
  suspect: SuspectFlowNode,
  evidence: EvidenceFlowNode,
  related: RelatedFlowNode,
};
