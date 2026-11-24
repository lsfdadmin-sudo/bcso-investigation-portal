"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { nodeSubtitle, nodeTitle } from "@/lib/present";
import type { GraphEdge, GraphNode } from "@/lib/types";

function impact(node: GraphNode, edges: GraphEdge[]) {
  const links = edges.filter((edge) => edge.sourceId === node.id || edge.targetId === node.id).length;
  const photos = node.photos.length;
  const linkText = links === 1 ? "1 linked connection" : `${links} linked connections`;
  const photoText = photos === 1 ? "1 uploaded photo" : `${photos} uploaded photos`;
  if (links && photos) return `Deleting this node also removes ${linkText} and ${photoText}.`;
  if (links) return `Deleting this node also removes ${linkText}.`;
  if (photos) return `Deleting this node also removes ${photoText}.`;
  return "This node has no linked connections or uploaded photos.";
}

const KIND_LABEL = {
  suspect: "Suspect",
  evidence: "Evidence",
  related: "Related item",
  case: "Case",
} as const;

export function DeleteNodeDialog({
  node,
  edges,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  node: GraphNode | null;
  edges: GraphEdge[];
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const variant = node?.kind === "suspect" ? "suspect" : node?.kind === "evidence" ? "evidence" : node?.kind === "related" ? "related" : "gold";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Confirm deletion</p>
          <DialogTitle>Delete this node?</DialogTitle>
          <DialogDescription>
            The chart keeps every other record. This only removes the selected node.
          </DialogDescription>
        </DialogHeader>
        {node ? (
          <div className="rounded-md border border-white/10 bg-obsidian px-3 py-3">
            <Badge variant={variant}>{KIND_LABEL[node.kind]}</Badge>
            <div className="mt-2 font-display text-2xl tracking-wide">{nodeTitle(node)}</div>
            <p className="mt-1 text-sm text-fog">{node.kind === "evidence" ? node.payload.description || nodeSubtitle(node) : nodeSubtitle(node)}</p>
          </div>
        ) : null}
        <div className="rounded-md border border-status-crimson/30 bg-status-crimson/10 px-3 py-3 text-sm leading-6">
          {node ? impact(node, edges) : "Nothing is selected."} This cannot be undone.
        </div>
        <DialogFooter>
          <Button ref={cancelRef} type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending || !node}>
            Delete node
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
