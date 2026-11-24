"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnNodeDrag,
} from "@xyflow/react";
import { ChevronsDownUp, ChevronsUpDown, LayoutGrid, LocateFixed, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteNodeDialog } from "@/components/case/delete-node-dialog";
import { EvidenceDialog } from "@/components/case/evidence-dialog";
import { GraphPerms, nodeTypes, type FlowNode } from "@/components/case/flow-nodes";
import { Inspector } from "@/components/case/inspector";
import { buildTree, type TreeMode } from "@/components/case/tree";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { can } from "@/lib/permissions";
import type { CaseEvent, GraphData, NodeKind } from "@/lib/types";
import "@xyflow/react/dist/style.css";

function GraphCanvas({
  caseId,
  graph,
  events,
  revision,
  locked,
  expandedEventIds,
  expandAllEvidence,
  activeEventId,
  focusNonce,
  focusEventId,
  onGraph,
  onToggleEvent,
  onExpandAll,
}: {
  caseId: string;
  graph: GraphData;
  events: CaseEvent[];
  revision: number;
  locked: boolean;
  expandedEventIds: string[];
  expandAllEvidence: boolean;
  activeEventId: string | null;
  focusNonce: number;
  focusEventId: string | null;
  onGraph: (graph: GraphData) => void;
  onToggleEvent: (eventId: string) => void;
  onExpandAll: (open: boolean) => void;
}) {
  const { role } = useSession();
  const { fitView } = useReactFlow<FlowNode, Edge<{ structural?: boolean }>>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<string | null>(null);
  const edgeDirty = useRef(false);
  const edgeDirtyId = useRef<string | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const [mode, setMode] = useState<TreeMode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [edgeLabel, setEdgeLabel] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [layoutNonce, setLayoutNonce] = useState(0);

  const expandedSet = useMemo(() => new Set(expandedEventIds), [expandedEventIds]);
  const display = useMemo(
    () =>
      buildTree({
        graph,
        events,
        mode,
        expandedEventIds: expandedSet,
        expandAllEvidence,
        activeEventId,
      }),
    [graph, events, mode, expandedSet, expandAllEvidence, activeEventId],
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  const [nodes, setLocalNodes, onNodesChange] = useNodesState<FlowNode>(display.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<{ structural?: boolean }>>(display.edges);
  const signatureRef = useRef("");
  const layoutSeen = useRef(layoutNonce);

  const canLink = !locked && can(role, "node:link");
  const canMove = !locked && can(role, "node:move");
  const canSuspect = !locked && can(role, "suspect:create");
  const canEvidence = !locked && can(role, "evidence:create");
  const canRelated = !locked && can(role, "related:create");
  const canDelete = !locked && can(role, "node:delete");

  useEffect(() => {
    const signature = display.nodes.map((node) => node.id).join("|");
    const forceIds = signatureRef.current !== signature;
    const forceLayout = layoutSeen.current !== layoutNonce;
    signatureRef.current = signature;
    layoutSeen.current = layoutNonce;
    const force = forceIds || forceLayout;
    setLocalNodes((current) => {
      if (force || current.length === 0) return display.nodes;
      return display.nodes.map((node) => {
        const prev = current.find((item) => item.id === node.id);
        if (!prev) return node;
        if (dragging.current === node.id) return { ...node, position: prev.position };
        return { ...node, position: prev.position };
      });
    });
    setEdges(display.edges);
    if (force) {
      setSettling(true);
      const timer = window.setTimeout(() => setSettling(false), 360);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [display, revision, layoutNonce, setLocalNodes, setEdges]);

  useEffect(() => {
    if (!focusNonce) return;
    const timer = window.setTimeout(() => {
      if (focusEventId) {
        const evidence = graphRef.current.nodes
          .filter((node) => node.kind === "evidence" && node.eventId === focusEventId)
          .map((node) => ({ id: node.id }));
        void fitView({
          nodes: [{ id: `event:${focusEventId}` }, ...evidence],
          duration: 450,
          padding: 0.35,
          maxZoom: 1.15,
        });
      } else {
        void fitView({ duration: 450, padding: 0.18 });
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [focusNonce, focusEventId, fitView]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let lastArea = 0;
    const observer = new ResizeObserver(() => {
      const area = element.clientWidth * element.clientHeight;
      if (lastArea < 1000 && area > 8000) {
        window.setTimeout(() => fitView({ padding: 0.18, duration: 200 }), 40);
      }
      lastArea = area;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitView]);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
  }, [graph.nodes, selectedId]);

  const viewEdges = edges.map((edge) => {
    const structural = Boolean(edge.data?.structural);
    const active = edge.id === edgeId;
    return {
      ...edge,
      style: structural
        ? { stroke: "rgba(212,175,55,0.55)", strokeWidth: 1.25, strokeDasharray: "5 4" }
        : { stroke: active ? "#e0b84c" : "rgba(231,236,243,0.4)", strokeWidth: active ? 2 : 1.25 },
      labelStyle: { fill: "#d5deea", fontSize: 10, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
      labelBgStyle: { fill: "#0f141c", fillOpacity: 0.95 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    };
  });

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedEdge = graph.edges.find((edge) => edge.id === edgeId) ?? null;
  const deleteTarget = graph.nodes.find((node) => node.id === deleteTargetId) ?? null;

  useEffect(() => {
    if (!selectedEdge) return;
    if (edgeDirty.current && edgeDirtyId.current === selectedEdge.id) return;
    edgeDirtyId.current = selectedEdge.id;
    edgeDirty.current = false;
    setEdgeLabel(selectedEdge.label);
  }, [selectedEdge]);

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    async (_event, node) => {
      dragging.current = null;
      if (!canMove || node.type === "event") return;
      try {
        await api(`/api/cases/${caseId}/nodes/${node.id}`, {
          method: "PATCH",
          body: JSON.stringify({ x: node.position.x, y: node.position.y }),
        });
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "The position was not saved.");
      }
    },
    [canMove, caseId],
  );

  async function connect(connection: Connection) {
    if (!canLink || !connection.source || !connection.target || connection.source === connection.target) return;
    if (connection.source.startsWith("event:") || connection.target.startsWith("event:")) return;
    try {
      await api(`/api/cases/${caseId}/edges`, {
        method: "POST",
        body: JSON.stringify({
          sourceId: connection.source,
          targetId: connection.target,
          label: "Associated With",
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        }),
      });
      onGraph(await api<GraphData>(`/api/cases/${caseId}/graph`));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The link was not created.");
    }
  }

  async function add(kind: Exclude<NodeKind, "case" | "evidence">) {
    const payload =
      kind === "suspect"
        ? { name: "New suspect", alias: "", status: "person_of_interest", notes: "" }
        : { title: "Related item", location: "", occurredAt: "", notes: "" };
    try {
      const next = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({ kind, payload }),
      });
      onGraph(next);
      const created = next.nodes.find((node) => !graph.nodes.some((existing) => existing.id === node.id));
      if (created) {
        setSelectedId(created.id);
        setEdgeId(null);
      }
      toast.success("Node added to the chart.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The node was not added.");
    }
  }

  async function autoLayout() {
    setLayoutNonce((value) => value + 1);
    const positions = displayRef.current.nodes
      .filter((node) => node.type !== "event")
      .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }));
    window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 40);
    if (!positions.length) return;
    try {
      await api(`/api/cases/${caseId}/positions`, {
        method: "POST",
        body: JSON.stringify({ positions }),
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The layout was not saved.");
    }
  }

  async function saveEdgeLabel() {
    if (!selectedEdge) return;
    try {
      await api(`/api/cases/${caseId}/edges/${selectedEdge.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: edgeLabel }),
      });
      edgeDirty.current = false;
      onGraph(await api<GraphData>(`/api/cases/${caseId}/graph`));
      toast.success("Relationship updated.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The relationship was not saved.");
    }
  }

  async function removeEdge() {
    if (!selectedEdge) return;
    try {
      await api(`/api/cases/${caseId}/edges/${selectedEdge.id}`, { method: "DELETE" });
      setEdgeId(null);
      onGraph(await api<GraphData>(`/api/cases/${caseId}/graph`));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The relationship was not removed.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/cases/${caseId}/nodes/${deleteTarget.id}`, { method: "DELETE" });
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTargetId(null);
      onGraph(await api<GraphData>(`/api/cases/${caseId}/graph`));
      toast.success("Node removed from the chart.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The node was not deleted.");
    } finally {
      setDeleting(false);
    }
  }

  const counts = {
    evidence: graph.nodes.filter((node) => node.kind === "evidence").length,
    suspects: graph.nodes.filter((node) => node.kind === "suspect").length,
  };
  const linkedEvents = events.filter((event) =>
    graph.nodes.some((node) => node.kind === "evidence" && node.eventId === event.id),
  );
  const allEvidenceOpen =
    expandAllEvidence || (linkedEvents.length > 0 && linkedEvents.every((event) => expandedSet.has(event.id)));

  return (
    <GraphPerms.Provider value={{ canLink }}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-3 py-2">
          {(["all", "evidence", "suspects"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                window.setTimeout(() => fitView({ padding: 0.18, duration: 250 }), 40);
              }}
              className={`rounded-md px-2.5 py-1 text-xs ${mode === value ? "bg-panel text-foreground" : "text-fog hover:text-foreground"}`}
            >
              {value === "all" ? "All links" : value === "evidence" ? `Evidence tree ${counts.evidence}` : `Suspects tree ${counts.suspects}`}
            </button>
          ))}
          <div className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onExpandAll(!allEvidenceOpen)}>
            {allEvidenceOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allEvidenceOpen ? "Collapse evidence" : "Expand all evidence"}
          </Button>
          {canSuspect ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void add("suspect")}>
              <Plus /> Add suspect
            </Button>
          ) : null}
          {canEvidence ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEvidenceOpen(true)}>
              <Plus /> Add evidence
            </Button>
          ) : null}
          {canRelated ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void add("related")}>
              <Plus /> Add related
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            {canDelete && selected && selected.kind !== "case" ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTargetId(selected.id)}>
                <Trash2 /> Delete node
              </Button>
            ) : null}
            {canMove ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => void autoLayout()}>
                <LayoutGrid /> Auto-layout
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => fitView({ padding: 0.18, duration: 250 })}>
              <LocateFixed /> Fit view
            </Button>
          </div>
        </div>
        {selectedEdge && canLink ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-panel/60 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-fog">Relationship</span>
            <Input
              value={edgeLabel}
              onChange={(event) => {
                edgeDirty.current = true;
                setEdgeLabel(event.target.value);
              }}
              className="h-8 max-w-xs"
              aria-label="Relationship label"
            />
            <Button type="button" size="sm" onClick={() => void saveEdgeLabel()}>
              Save label
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void removeEdge()}>
              Unlink
            </Button>
          </div>
        ) : null}
        <div ref={canvasRef} className={`relative min-h-0 flex-1 ${settling ? "graph-settling" : ""}`}>
          <ReactFlow
            nodes={nodes}
            edges={viewEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection) => void connect(connection)}
            onNodeClick={(_event, node) => {
              if (node.type === "event") {
                const eventId = node.id.slice("event:".length);
                setSelectedId(null);
                setEdgeId(null);
                onToggleEvent(eventId);
                return;
              }
              setSelectedId(node.id);
              setEdgeId(null);
            }}
            onEdgeClick={(_event, edge) => {
              if (edge.data?.structural) return;
              setEdgeId(edge.id);
              setSelectedId(null);
            }}
            onPaneClick={() => {
              setSelectedId(null);
              setEdgeId(null);
            }}
            onNodeDragStart={(_event, node) => {
              dragging.current = node.id;
            }}
            onNodeDragStop={onNodeDragStop}
            nodesDraggable={canMove}
            nodesConnectable={canLink}
            elementsSelectable
            connectionMode={ConnectionMode.Loose}
            fitView
            forceColorMode="dark"
            minZoom={0.2}
            maxZoom={1.75}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: false }}
            connectionLineStyle={{ stroke: "#d4af37", strokeWidth: 1.5 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.15} color="rgba(212,175,55,0.16)" />
            <Controls showInteractive={false} />
            <MiniMap
              position="top-right"
              pannable
              zoomable
              bgColor="#0f141c"
              maskColor="rgba(9,12,16,0.72)"
              nodeColor={(node) => {
                if (node.type === "case") return "#d4af37";
                if (node.type === "suspect") return "#e5484d";
                if (node.type === "evidence") return "#3bc9db";
                if (node.type === "event") return "#e0b84c";
                return "#818cf8";
              }}
            />
          </ReactFlow>
          {selected ? (
            <Inspector
              caseId={caseId}
              node={selected}
              nodes={graph.nodes}
              edges={graph.edges}
              events={events}
              locked={locked}
              onClose={() => setSelectedId(null)}
              onGraph={onGraph}
              onRequestDelete={() => setDeleteTargetId(selected.id)}
              onFocus={(id) => {
                setSelectedId(id);
                setEdgeId(null);
              }}
            />
          ) : null}
        </div>
      </div>
      <EvidenceDialog
        open={evidenceOpen}
        caseId={caseId}
        events={events}
        onOpenChange={setEvidenceOpen}
        onCreated={(next) => {
          onGraph(next);
          const created = next.nodes.find((node) => !graph.nodes.some((existing) => existing.id === node.id));
          if (created) {
            setSelectedId(created.id);
            setEdgeId(null);
          }
        }}
      />
      <DeleteNodeDialog
        node={deleteTarget}
        edges={graph.edges}
        open={Boolean(deleteTarget)}
        pending={deleting}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTargetId(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </GraphPerms.Provider>
  );
}

export function GraphPane(props: {
  caseId: string;
  graph: GraphData;
  events: CaseEvent[];
  revision: number;
  locked: boolean;
  expandedEventIds: string[];
  expandAllEvidence: boolean;
  activeEventId: string | null;
  focusNonce: number;
  focusEventId: string | null;
  onGraph: (graph: GraphData) => void;
  onToggleEvent: (eventId: string) => void;
  onExpandAll: (open: boolean) => void;
}) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
