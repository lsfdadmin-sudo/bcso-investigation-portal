import { MarkerType, type Edge } from "@xyflow/react";
import type { FlowNode } from "@/components/case/flow-nodes";
import type { CaseEvent, GraphData, GraphNode } from "@/lib/types";

export type TreeMode = "all" | "evidence" | "suspects";

const COL_SUSPECT = 0;
const COL_RELATED = 360;
const COL_EVENT = 720;
const COL_EVIDENCE = 1100;
const TOP = 210;
const GAP = 40;

function stackHeight(count: number, item: number) {
  if (count <= 0) return 0;
  return count * item + (count - 1) * GAP;
}

function placeColumn(nodes: GraphNode[], x: number, startY: number, itemHeight: number) {
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, index) => {
    positions.set(node.id, { x, y: startY + index * (itemHeight + GAP) });
  });
  return positions;
}

export function buildTree(input: {
  graph: GraphData;
  events: CaseEvent[];
  mode: TreeMode;
  expandedEventIds: ReadonlySet<string>;
  expandAllEvidence: boolean;
  activeEventId: string | null;
}): { nodes: FlowNode[]; edges: Edge<{ structural?: boolean }>[] } {
  const caseNode = input.graph.nodes.find((node) => node.kind === "case");
  if (!caseNode) return { nodes: [], edges: [] };

  const showSuspects = input.mode !== "evidence";
  const showRelated = input.mode === "all";
  const showEvents = input.mode !== "suspects";
  const eventIds = new Set(input.events.map((event) => event.id));

  const suspects = showSuspects ? input.graph.nodes.filter((node) => node.kind === "suspect") : [];
  const related = showRelated ? input.graph.nodes.filter((node) => node.kind === "related") : [];
  const evidence = input.graph.nodes.filter((node) => node.kind === "evidence");

  const linked = new Map<string, GraphNode[]>();
  const loose: GraphNode[] = [];
  for (const node of evidence) {
    if (node.kind !== "evidence") continue;
    if (node.eventId && eventIds.has(node.eventId)) {
      const list = linked.get(node.eventId) ?? [];
      list.push(node);
      linked.set(node.eventId, list);
    } else {
      loose.push(node);
    }
  }

  const visibleEvents = showEvents ? input.events : [];
  const revealed = (eventId: string) => input.expandAllEvidence || input.expandedEventIds.has(eventId);

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(caseNode.id, { x: COL_RELATED, y: 0 });
  for (const [id, point] of placeColumn(suspects, COL_SUSPECT, TOP, 148)) positions.set(id, point);
  for (const [id, point] of placeColumn(related, COL_RELATED, TOP, 132)) positions.set(id, point);

  let eventY = TOP;
  const shownEvidence = new Map<string, GraphNode[]>();
  for (const event of visibleEvents) {
    const attached = linked.get(event.id) ?? [];
    const open = revealed(event.id);
    const visibleAttached = open ? attached : [];
    shownEvidence.set(event.id, visibleAttached);
    const evidenceHeight = stackHeight(visibleAttached.length, 168);
    const block = Math.max(176, evidenceHeight);
    positions.set(`event:${event.id}`, { x: COL_EVENT, y: eventY });
    visibleAttached.forEach((node, index) => {
      positions.set(node.id, { x: COL_EVIDENCE, y: eventY + index * (168 + GAP) });
    });
    eventY += block + GAP;
  }

  const looseVisible = showEvents ? loose : [];
  looseVisible.forEach((node, index) => {
    positions.set(node.id, { x: COL_EVIDENCE, y: eventY + index * (168 + GAP) });
  });

  const visibleIds = new Set(positions.keys());
  const nodes: FlowNode[] = [];

  const pushRecord = (node: GraphNode) => {
    const position = positions.get(node.id);
    if (!position) return;
    nodes.push({
      id: node.id,
      type: node.kind,
      position,
      data: { node },
      connectable: true,
    });
  };

  pushRecord(caseNode);
  suspects.forEach(pushRecord);
  related.forEach(pushRecord);
  for (const event of visibleEvents) {
    const position = positions.get(`event:${event.id}`);
    if (!position) continue;
    const count = (linked.get(event.id) ?? []).length;
    nodes.push({
      id: `event:${event.id}`,
      type: "event",
      position,
      draggable: false,
      connectable: false,
      data: {
        event,
        evidenceCount: count,
        expanded: revealed(event.id),
        active: input.activeEventId === event.id,
      },
    });
  }
  for (const event of visibleEvents) {
    for (const node of shownEvidence.get(event.id) ?? []) pushRecord(node);
  }
  looseVisible.forEach(pushRecord);

  const byId = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const edges: Edge<{ structural?: boolean }>[] = [];
  for (const edge of input.graph.edges) {
    if (!visibleIds.has(edge.sourceId) || !visibleIds.has(edge.targetId)) continue;
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    const grouped =
      (source?.kind === "case" && target?.kind === "evidence" && target.eventId && eventIds.has(target.eventId)) ||
      (target?.kind === "case" && source?.kind === "evidence" && source.eventId && eventIds.has(source.eventId));
    if (grouped) continue;
    edges.push({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      sourceHandle: edge.sourceHandle ?? "b",
      targetHandle: edge.targetHandle ?? "t",
      label: edge.label,
      type: "smoothstep",
      data: { structural: false },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "rgba(231,236,243,0.5)" },
    });
  }

  for (const event of visibleEvents) {
    edges.push({
      id: `struct:case:${event.id}`,
      source: caseNode.id,
      target: `event:${event.id}`,
      sourceHandle: "b",
      targetHandle: "t",
      type: "smoothstep",
      data: { structural: true },
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "rgba(212,175,55,0.75)" },
    });
    for (const node of shownEvidence.get(event.id) ?? []) {
      edges.push({
        id: `struct:event:${event.id}:${node.id}`,
        source: `event:${event.id}`,
        target: node.id,
        sourceHandle: "r",
        targetHandle: "l",
        type: "smoothstep",
        data: { structural: true },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "rgba(212,175,55,0.75)" },
      });
    }
  }

  return { nodes, edges };
}
