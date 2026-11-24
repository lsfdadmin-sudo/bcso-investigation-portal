export type Role = "patrol" | "detective" | "admin";

export type Session = {
  badge: string;
  role: Role;
};

export type CaseStatus = "open" | "closed";

export type SuspectStatus = "at_large" | "in_custody" | "witness" | "person_of_interest";

export type EvidenceCategory =
  | "weapon"
  | "vehicle"
  | "forensics"
  | "document"
  | "media"
  | "narcotics"
  | "other";

export type NodeKind = "case" | "suspect" | "evidence" | "related";

export type Photo = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
  createdAt: string;
};

export type CasePayload = {
  caseNumber: string;
  incidentType: string;
  location: string;
};

export type SuspectPayload = {
  name: string;
  alias: string;
  status: SuspectStatus;
  notes: string;
};

export type EvidencePayload = {
  tag: string;
  category: EvidenceCategory;
  description: string;
  custody: string;
  notes: string;
};

export type RelatedPayload = {
  title: string;
  location: string;
  occurredAt: string;
  notes: string;
};

export type GraphNode =
  | {
      id: string;
      kind: "case";
      x: number;
      y: number;
      payload: CasePayload;
      photos: Photo[];
      updatedAt: string;
    }
  | {
      id: string;
      kind: "suspect";
      x: number;
      y: number;
      payload: SuspectPayload;
      photos: Photo[];
      updatedAt: string;
    }
  | {
      id: string;
      kind: "evidence";
      x: number;
      y: number;
      payload: EvidencePayload;
      photos: Photo[];
      updatedAt: string;
    }
  | {
      id: string;
      kind: "related";
      x: number;
      y: number;
      payload: RelatedPayload;
      photos: Photo[];
      updatedAt: string;
    };

export type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string;
};

export type Responder = {
  id: string;
  badge: string;
  callsign: string;
  name: string;
  role: string;
};

export type CaseEvent = {
  id: string;
  occurredAt: string;
  badge: string;
  unit: string;
  title: string;
  eventType: string;
  findings: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseSummary = {
  id: string;
  caseNumber: string;
  incidentType: string;
  location: string;
  occurredAt: string;
  status: CaseStatus;
  narrative: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  eventCount: number;
  suspectCount: number;
  evidenceCount: number;
};

export type CaseDetail = CaseSummary & {
  responders: Responder[];
  events: CaseEvent[];
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
