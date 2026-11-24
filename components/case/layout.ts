import dagre from "dagre";
import type { GraphEdge, GraphNode, NodeKind } from "@/lib/types";

const WIDTH = 250;

function height(kind: NodeKind) {
  if (kind === "evidence") return 156;
  if (kind === "case") return 122;
  return 136;
}

export function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100, marginx: 32, marginy: 32 });
  for (const node of nodes) {
    graph.setNode(node.id, { width: WIDTH, height: height(node.kind) });
  }
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (ids.has(edge.sourceId) && ids.has(edge.targetId)) {
      graph.setEdge(edge.sourceId, edge.targetId);
    }
  }
  dagre.layout(graph);
  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      id: node.id,
      x: Math.round(position.x - WIDTH / 2),
      y: Math.round(position.y - height(node.kind) / 2),
    };
  });
}
