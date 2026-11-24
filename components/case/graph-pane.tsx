"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
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
import { LayoutGrid, LocateFixed, Plus } from "lucide-react";
import { toast } from "sonner";
import { GraphPerms, nodeTypes, type FlowNode } from "@/components/case/flow-nodes";
import { Inspector } from "@/components/case/inspector";
import { layoutNodes } from "@/components/case/layout";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/client";
import { can } from "@/lib/permissions";
import type { GraphData, NodeKind } from "@/lib/types";
import "@xyflow/react/dist/style.css";

type Mode = "all" | "evidence" | "suspects";

function toNodes(graph: GraphData): FlowNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: node.kind,
    position: { x: node.x, y: node.y },
    data: { node },
  }));
}

function toEdges(graph: GraphData): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    sourceHandle: edge.sourceHandle ?? "b",
    targetHandle: edge.targetHandle ?? "t",
    label: edge.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "rgba(231,236,243,0.5)" },
  }));
}

function GraphCanvas({
  caseId,
  graph,
  revision,
  locked,
  onGraph,
}: {
  caseId: string;
  graph: GraphData;
  revision: number;
  locked: boolean;
  onGraph: (graph: GraphData) => void;
}) {
  const { role } = useSession();
  const { fitView } = useReactFlow<FlowNode, Edge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setLocalNodes, onNodesChange] = useNodesState<FlowNode>(toNodes(graph));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(graph));
  const [mode, setMode] = useState<Mode>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [edgeLabel, setEdgeLabel] = useState("");

  const canLink = !locked && can(role, "node:link");
  const canMove = !locked && can(role, "node:move");
  const canSuspect = !locked && can(role, "suspect:create");
  const canEvidence = !locked && can(role, "evidence:create");
  const canRelated = !locked && can(role, "related:create");

  useEffect(() => {
    setLocalNodes(toNodes(graph));
    setEdges(toEdges(graph));
  }, [revision, graph, setLocalNodes, setEdges]);

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

  const visibleIds = useMemo(() => {
    if (mode === "all") return new Set(graph.nodes.map((node) => node.id));
    const kind = mode === "evidence" ? "evidence" : "suspect";
    return new Set(graph.nodes.filter((node) => node.kind === "case" || node.kind === kind).map((node) => node.id));
  }, [graph.nodes, mode]);

  const viewNodes = nodes.map((node) => ({ ...node, hidden: !visibleIds.has(node.id) }));
  const viewEdges = edges.map((edge) => ({
    ...edge,
    hidden: !visibleIds.has(edge.source) || !visibleIds.has(edge.target),
    style: {
      stroke: edge.id === edgeId ? "#e0b84c" : "rgba(231,236,243,0.4)",
      strokeWidth: edge.id === edgeId ? 2 : 1.25,
    },
    labelStyle: { fill: "#d5deea", fontSize: 10, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" },
    labelBgStyle: { fill: "#0f141c", fillOpacity: 0.95 },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  }));

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const selectedEdge = graph.edges.find((edge) => edge.id === edgeId) ?? null;

  useEffect(() => {
    if (selectedEdge) setEdgeLabel(selectedEdge.label);
  }, [selectedEdge]);

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    async (_event, node) => {
      if (!canMove) return;
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

  async function add(kind: Exclude<NodeKind, "case">) {
    const payload =
      kind === "suspect"
        ? { name: "New suspect", alias: "", status: "person_of_interest", notes: "" }
        : kind === "evidence"
          ? { tag: "", category: "other", description: "New evidence", custody: "", notes: "" }
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
    const positions = layoutNodes(graph.nodes, graph.edges);
    setLocalNodes((current) =>
      current.map((node) => {
        const next = positions.find((position) => position.id === node.id);
        return next ? { ...node, position: { x: next.x, y: next.y } } : node;
      }),
    );
    try {
      await api(`/api/cases/${caseId}/positions`, {
        method: "POST",
        body: JSON.stringify({ positions }),
      });
      window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 30);
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

  const counts = {
    evidence: graph.nodes.filter((node) => node.kind === "evidence").length,
    suspects: graph.nodes.filter((node) => node.kind === "suspect").length,
  };

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
          {canSuspect ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void add("suspect")}>
              <Plus /> Add suspect
            </Button>
          ) : null}
          {canEvidence ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void add("evidence")}>
              <Plus /> Add evidence
            </Button>
          ) : null}
          {canRelated ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => void add("related")}>
              <Plus /> Add related
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
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
            <Input value={edgeLabel} onChange={(event) => setEdgeLabel(event.target.value)} className="h-8 max-w-xs" aria-label="Relationship label" />
            <Button type="button" size="sm" onClick={() => void saveEdgeLabel()}>
              Save label
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void removeEdge()}>
              Unlink
            </Button>
          </div>
        ) : null}
        <div ref={canvasRef} className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={viewNodes}
            edges={viewEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(connection) => void connect(connection)}
            onNodeClick={(_event, node) => {
              setSelectedId(node.id);
              setEdgeId(null);
            }}
            onEdgeClick={(_event, edge) => {
              setEdgeId(edge.id);
              setSelectedId(null);
            }}
            onPaneClick={() => {
              setSelectedId(null);
              setEdgeId(null);
            }}
            onNodeDragStop={onNodeDragStop}
            nodesDraggable={canMove}
            nodesConnectable={canLink}
            elementsSelectable
            connectionMode={ConnectionMode.Loose}
            fitView
            forceColorMode="dark"
            minZoom={0.25}
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
                return "#818cf8";
              }}
            />
          </ReactFlow>
          {mode !== "all" && counts[mode] === 0 ? (
            <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-md border border-white/10 bg-ink/90 px-3 py-2 text-xs text-fog">
              No {mode === "evidence" ? "evidence" : "suspects"} on this case yet.
            </div>
          ) : null}
          {selected ? (
            <Inspector
              caseId={caseId}
              node={selected}
              nodes={graph.nodes}
              edges={graph.edges}
              locked={locked}
              onClose={() => setSelectedId(null)}
              onGraph={onGraph}
              onFocus={(id) => {
                setSelectedId(id);
                setEdgeId(null);
              }}
            />
          ) : null}
        </div>
      </div>
    </GraphPerms.Provider>
  );
}

export function GraphPane(props: {
  caseId: string;
  graph: GraphData;
  revision: number;
  locked: boolean;
  onGraph: (graph: GraphData) => void;
}) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
