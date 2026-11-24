import type { GraphNode } from "./types";
import { evidenceCategoryLabel, suspectStatusLabel } from "./constants";

export function nodeTitle(node: GraphNode) {
  switch (node.kind) {
    case "case":
      return node.payload.incidentType;
    case "suspect":
      return node.payload.name;
    case "evidence":
      return node.payload.tag;
    case "related":
      return node.payload.title;
  }
}

export function nodeSubtitle(node: GraphNode) {
  switch (node.kind) {
    case "case":
      return node.payload.caseNumber;
    case "suspect":
      return node.payload.alias ? `Alias ${node.payload.alias}` : "No alias on file";
    case "evidence":
      return evidenceCategoryLabel(node.payload.category);
    case "related":
      return node.payload.location || "Related item";
  }
}

export function nodeMeta(node: GraphNode) {
  switch (node.kind) {
    case "case":
      return node.payload.location;
    case "suspect":
      return suspectStatusLabel(node.payload.status);
    case "evidence":
      return node.payload.description;
    case "related":
      return node.payload.notes;
  }
}
