import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { EVIDENCE_CATEGORIES, SUSPECT_STATUSES } from "./constants";
import { getDb, transaction } from "./db";
import { HttpError } from "./http";
import { emitLive } from "./live";
import { uploadDir } from "./paths";
import type {
  CaseDetail,
  CaseEvent,
  CasePayload,
  CaseStatus,
  CaseSummary,
  EvidenceCategory,
  EvidencePayload,
  GraphData,
  GraphEdge,
  GraphNode,
  NodeKind,
  Photo,
  RelatedPayload,
  Responder,
  SuspectPayload,
  SuspectStatus,
} from "./types";

type CaseRow = {
  id: string;
  case_number: string;
  incident_type: string;
  location: string;
  occurred_at: string;
  narrative: string;
  status: CaseStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  event_count?: number;
  suspect_count?: number;
  evidence_count?: number;
};

const SUSPECT_STATUS = new Set(SUSPECT_STATUSES.map((item) => item.value));
const EVIDENCE_CATEGORY = new Set(EVIDENCE_CATEGORIES.map((item) => item.value));

function nowIso() {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("That record could not be read.", 500);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = true) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw && required) throw new HttpError(`${label} is required.`, 400);
  if (raw.length > max) throw new HttpError(`${label} must be ${max} characters or fewer.`, 400);
  return raw;
}

function optionalText(value: unknown, label: string, max: number) {
  return text(value ?? "", label, max, false);
}

function asDate(value: unknown, label: string) {
  const raw = text(value, label, 40);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new HttpError(`Enter a valid ${label.toLowerCase()}.`, 400);
  return date.toISOString();
}

function mapSummary(row: CaseRow): CaseSummary {
  return {
    id: row.id,
    caseNumber: row.case_number,
    incidentType: row.incident_type,
    location: row.location,
    occurredAt: row.occurred_at,
    status: row.status,
    narrative: row.narrative,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    eventCount: Number(row.event_count ?? 0),
    suspectCount: Number(row.suspect_count ?? 0),
    evidenceCount: Number(row.evidence_count ?? 0),
  };
}

function mustCase(id: string, database: DatabaseSync = getDb()) {
  const row = database.prepare("SELECT * FROM cases WHERE id = ?").get(id) as CaseRow | undefined;
  if (!row) throw new HttpError("Case file not found.", 404);
  return row;
}

function assertMutable(row: CaseRow) {
  if (row.status === "closed") {
    throw new HttpError("This case is closed. Reopen it before editing the file.", 409);
  }
}

function touchCase(database: DatabaseSync, caseId: string, stamp = nowIso()) {
  database.prepare("UPDATE cases SET updated_at = ? WHERE id = ?").run(stamp, caseId);
}

function syncRoot(database: DatabaseSync, caseId: string) {
  const row = mustCase(caseId, database);
  const payload: CasePayload = {
    caseNumber: row.case_number,
    incidentType: row.incident_type,
    location: row.location,
  };
  database
    .prepare("UPDATE nodes SET payload = ?, updated_at = ? WHERE case_id = ? AND kind = 'case'")
    .run(JSON.stringify(payload), nowIso(), caseId);
}

function parsePayload(kind: NodeKind, raw: unknown): CasePayload | SuspectPayload | EvidencePayload | RelatedPayload {
  const value = asRecord(raw);
  if (kind === "case") {
    return {
      caseNumber: text(value.caseNumber, "Case number", 40),
      incidentType: text(value.incidentType, "Incident type", 80),
      location: text(value.location, "Location", 160),
    };
  }
  if (kind === "suspect") {
    const status = text(value.status, "Status", 40);
    if (!SUSPECT_STATUS.has(status as SuspectStatus)) throw new HttpError("Choose a suspect status.", 400);
    return {
      name: text(value.name, "Name", 80),
      alias: optionalText(value.alias, "Alias", 80),
      status: status as SuspectStatus,
      notes: optionalText(value.notes, "Notes", 4000),
    };
  }
  if (kind === "evidence") {
    const category = text(value.category ?? "other", "Category", 40);
    if (!EVIDENCE_CATEGORY.has(category as EvidenceCategory)) {
      throw new HttpError("Choose an evidence category.", 400);
    }
    return {
      tag: text(value.tag, "Evidence tag", 40),
      category: category as EvidenceCategory,
      description: optionalText(value.description, "Description", 2000),
      custody: optionalText(value.custody, "Chain of custody", 2000),
      notes: optionalText(value.notes, "Notes", 4000),
    };
  }
  return {
    title: text(value.title, "Title", 120),
    location: optionalText(value.location, "Location", 160),
    occurredAt: value.occurredAt ? asDate(value.occurredAt, "Date") : "",
    notes: optionalText(value.notes, "Notes", 4000),
  };
}

function nextCaseNumber(database: DatabaseSync) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = `BCSO-${year}-`;
  const row = database
    .prepare("SELECT case_number FROM cases WHERE case_number LIKE ? ORDER BY case_number DESC LIMIT 1")
    .get(`${prefix}%`) as { case_number: string } | undefined;
  const current = row ? Number(row.case_number.slice(prefix.length)) : 1000;
  const next = Number.isFinite(current) ? current + 1 : 1001;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function nextEvidenceTag(database: DatabaseSync, caseId: string, caseNumber: string) {
  const seq = caseNumber.split("-").pop() || "0000";
  const rows = database.prepare("SELECT payload FROM nodes WHERE case_id = ? AND kind = 'evidence'").all(caseId) as {
    payload: string;
  }[];
  const used = new Set(
    rows.map((row) => {
      try {
        return String(asRecord(JSON.parse(row.payload)).tag ?? "");
      } catch {
        return "";
      }
    }),
  );
  let index = rows.length + 1;
  let tag = `E-${seq}-${String(index).padStart(2, "0")}`;
  while (used.has(tag)) {
    index += 1;
    tag = `E-${seq}-${String(index).padStart(2, "0")}`;
  }
  return tag;
}

function placeNode(database: DatabaseSync, caseId: string, kind: NodeKind) {
  const rows = database.prepare("SELECT pos_x, pos_y FROM nodes WHERE case_id = ?").all(caseId) as {
    pos_x: number;
    pos_y: number;
  }[];
  const x = kind === "suspect" ? 40 : kind === "evidence" ? 820 : 430;
  let y = 80;
  const collides = (px: number, py: number) =>
    rows.some((row) => Math.abs(row.pos_x - px) < 220 && Math.abs(row.pos_y - py) < 140);
  while (collides(x, y)) y += 180;
  return { x, y };
}

function rootId(database: DatabaseSync, caseId: string) {
  const row = database.prepare("SELECT id FROM nodes WHERE case_id = ? AND kind = 'case'").get(caseId) as
    | { id: string }
    | undefined;
  if (!row) throw new HttpError("Case root is missing from the chart.", 500);
  return row.id;
}

function defaultLinkLabel(kind: NodeKind) {
  if (kind === "suspect") return "Suspect In";
  if (kind === "evidence") return "Recovered At";
  return "Associated With";
}

export function listCases(filters: { status: CaseStatus; q?: string; type?: string }) {
  const database = getDb();
  const q = filters.q?.trim() ?? "";
  const type = filters.type?.trim() ?? "";
  const like = `%${q}%`;
  const rows = database
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM events e WHERE e.case_id = c.id) AS event_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'suspect') AS suspect_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'evidence') AS evidence_count
      FROM cases c
      WHERE c.status = ?
        AND (? = '' OR c.incident_type = ?)
        AND (
          ? = ''
          OR c.case_number LIKE ? COLLATE NOCASE
          OR c.location LIKE ? COLLATE NOCASE
          OR c.incident_type LIKE ? COLLATE NOCASE
        )
      ORDER BY c.occurred_at DESC`,
    )
    .all(filters.status, type, type, q, like, like, like) as CaseRow[];

  const counts = database.prepare("SELECT status, COUNT(*) AS count FROM cases GROUP BY status").all() as {
    status: CaseStatus;
    count: number;
  }[];
  const types = database
    .prepare("SELECT DISTINCT incident_type FROM cases ORDER BY incident_type COLLATE NOCASE")
    .all() as { incident_type: string }[];

  return {
    cases: rows.map(mapSummary),
    counts: {
      open: Number(counts.find((row) => row.status === "open")?.count ?? 0),
      closed: Number(counts.find((row) => row.status === "closed")?.count ?? 0),
    },
    incidentTypes: types.map((row) => row.incident_type),
  };
}

function respondersFor(database: DatabaseSync, caseId: string): Responder[] {
  const rows = database
    .prepare(
      "SELECT id, badge, callsign, name, role FROM responders WHERE case_id = ? ORDER BY sort_order ASC, name ASC",
    )
    .all(caseId) as Responder[];
  return rows;
}

function eventsFor(database: DatabaseSync, caseId: string): CaseEvent[] {
  const rows = database
    .prepare(
      `SELECT id, occurred_at, badge, unit, title, event_type, findings, created_by, created_at, updated_at
       FROM events WHERE case_id = ? ORDER BY occurred_at ASC, created_at ASC`,
    )
    .all(caseId) as {
    id: string;
    occurred_at: string;
    badge: string;
    unit: string;
    title: string;
    event_type: string;
    findings: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    badge: row.badge,
    unit: row.unit,
    title: row.title,
    eventType: row.event_type,
    findings: row.findings,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getCaseDetail(id: string): CaseDetail {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM events e WHERE e.case_id = c.id) AS event_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'suspect') AS suspect_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'evidence') AS evidence_count
      FROM cases c WHERE c.id = ?`,
    )
    .get(id) as CaseRow | undefined;
  if (!row) throw new HttpError("Case file not found.", 404);
  return { ...mapSummary(row), responders: respondersFor(database, id), events: eventsFor(database, id) };
}

export type ResponderInput = { badge: string; callsign: string; name: string; role: string };

export function createCase(input: {
  incidentType: string;
  location: string;
  occurredAt: string;
  narrative?: string;
  responders?: ResponderInput[];
  badge: string;
}) {
  const created = transaction((database) => {
    const id = randomUUID();
    const stamp = nowIso();
    const caseNumber = nextCaseNumber(database);
    const occurredAt = asDate(input.occurredAt, "Date and time");
    const incidentType = text(input.incidentType, "Incident type", 80);
    const location = text(input.location, "Location", 160);
    const narrative = optionalText(input.narrative ?? "", "Narrative", 20000);
    database
      .prepare(
        `INSERT INTO cases (
          id, case_number, incident_type, location, occurred_at, narrative, status,
          created_by, created_at, updated_at, closed_at, closed_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, NULL)`,
      )
      .run(id, caseNumber, incidentType, location, occurredAt, narrative, input.badge, stamp, stamp);
    const responders = input.responders ?? [];
    const insertResponder = database.prepare(
      "INSERT INTO responders (id, case_id, badge, callsign, name, role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    responders.forEach((responder, index) => {
      insertResponder.run(
        randomUUID(),
        id,
        text(responder.badge, "Badge", 16),
        text(responder.callsign, "Callsign", 24),
        text(responder.name, "Name", 80),
        text(responder.role, "Role", 40),
        index,
      );
    });
    database
      .prepare(
        "INSERT INTO nodes (id, case_id, kind, pos_x, pos_y, payload, created_at, updated_at) VALUES (?, ?, 'case', 360, 40, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        id,
        JSON.stringify({ caseNumber, incidentType, location } satisfies CasePayload),
        stamp,
        stamp,
      );
    return getCaseDetailFrom(database, id);
  });
  emitLive({ caseId: created.id, kind: "case", action: "create" });
  return created;
}

function getCaseDetailFrom(database: DatabaseSync, id: string): CaseDetail {
  const row = database
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM events e WHERE e.case_id = c.id) AS event_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'suspect') AS suspect_count,
        (SELECT COUNT(*) FROM nodes n WHERE n.case_id = c.id AND n.kind = 'evidence') AS evidence_count
      FROM cases c WHERE c.id = ?`,
    )
    .get(id) as CaseRow;
  return { ...mapSummary(row), responders: respondersFor(database, id), events: eventsFor(database, id) };
}

export function updateCase(
  id: string,
  patch: {
    incidentType?: string;
    location?: string;
    occurredAt?: string;
    narrative?: string;
    status?: CaseStatus;
  },
  badge: string,
) {
  const existingStatus = mustCase(id).status;
  const updated = transaction((database) => {
    const existing = mustCase(id, database);
    const dataTouched =
      patch.incidentType !== undefined ||
      patch.location !== undefined ||
      patch.occurredAt !== undefined ||
      patch.narrative !== undefined;
    if (dataTouched) assertMutable(existing);
    const incidentType =
      patch.incidentType !== undefined ? text(patch.incidentType, "Incident type", 80) : existing.incident_type;
    const location = patch.location !== undefined ? text(patch.location, "Location", 160) : existing.location;
    const occurredAt = patch.occurredAt !== undefined ? asDate(patch.occurredAt, "Date and time") : existing.occurred_at;
    const narrative = patch.narrative !== undefined ? optionalText(patch.narrative, "Narrative", 20000) : existing.narrative;
    let status = existing.status;
    let closedAt = existing.closed_at;
    let closedBy = existing.closed_by;
    if (patch.status && patch.status !== existing.status) {
      if (patch.status !== "open" && patch.status !== "closed") throw new HttpError("Status must be open or closed.", 400);
      status = patch.status;
      closedAt = status === "closed" ? nowIso() : null;
      closedBy = status === "closed" ? badge : null;
    }
    const stamp = nowIso();
    database
      .prepare(
        `UPDATE cases
         SET incident_type = ?, location = ?, occurred_at = ?, narrative = ?, status = ?,
             closed_at = ?, closed_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(incidentType, location, occurredAt, narrative, status, closedAt, closedBy, stamp, id);
    syncRoot(database, id);
    return getCaseDetailFrom(database, id);
  });
  emitLive({
    caseId: id,
    kind: patch.status && patch.status !== existingStatus ? "status" : "case",
    action: "update",
  });
  return updated;
}

function photoFilesForCase(database: DatabaseSync, caseId: string) {
  return database
    .prepare(
      `SELECT p.filename FROM photos p
       JOIN nodes n ON n.id = p.node_id
       WHERE n.case_id = ?`,
    )
    .all(caseId) as { filename: string }[];
}

export function deleteCase(id: string) {
  const database = getDb();
  mustCase(id, database);
  const files = photoFilesForCase(database, id);
  transaction((tx) => {
    tx.prepare("DELETE FROM cases WHERE id = ?").run(id);
  });
  for (const file of files) unlinkUpload(file.filename);
  emitLive({ caseId: id, kind: "case", action: "delete" });
  return { ok: true };
}

export function replaceResponders(caseId: string, responders: ResponderInput[]) {
  const roster = transaction((database) => {
    const existing = mustCase(caseId, database);
    assertMutable(existing);
    if (responders.length > 24) throw new HttpError("A case can list up to 24 responders.", 400);
    database.prepare("DELETE FROM responders WHERE case_id = ?").run(caseId);
    const insert = database.prepare(
      "INSERT INTO responders (id, case_id, badge, callsign, name, role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    responders.forEach((responder, index) => {
      insert.run(
        randomUUID(),
        caseId,
        text(responder.badge, "Badge", 16),
        text(responder.callsign, "Callsign", 24),
        text(responder.name, "Name", 80),
        text(responder.role, "Role", 40),
        index,
      );
    });
    touchCase(database, caseId);
    return respondersFor(database, caseId);
  });
  emitLive({ caseId, kind: "responders", action: "update" });
  return roster;
}

export function createEvent(
  caseId: string,
  input: { occurredAt: string; badge: string; unit: string; title: string; eventType: string; findings: string },
  createdBy: string,
) {
  const created = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const id = randomUUID();
    const stamp = nowIso();
    database
      .prepare(
        `INSERT INTO events (
          id, case_id, occurred_at, badge, unit, title, event_type, findings, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        caseId,
        asDate(input.occurredAt, "Timestamp"),
        text(input.badge, "Badge", 16),
        text(input.unit, "Unit", 24),
        text(input.title, "Title", 120),
        text(input.eventType, "Event type", 40),
        text(input.findings, "Findings", 8000),
        createdBy,
        stamp,
        stamp,
      );
    touchCase(database, caseId, stamp);
    return eventsFor(database, caseId).find((event) => event.id === id);
  });
  emitLive({ caseId, kind: "event", action: "create" });
  return created;
}

export function updateEvent(
  caseId: string,
  eventId: string,
  input: { occurredAt: string; badge: string; unit: string; title: string; eventType: string; findings: string },
) {
  const updated = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const existing = database.prepare("SELECT id FROM events WHERE id = ? AND case_id = ?").get(eventId, caseId);
    if (!existing) throw new HttpError("Event not found.", 404);
    const stamp = nowIso();
    database
      .prepare(
        `UPDATE events
         SET occurred_at = ?, badge = ?, unit = ?, title = ?, event_type = ?, findings = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        asDate(input.occurredAt, "Timestamp"),
        text(input.badge, "Badge", 16),
        text(input.unit, "Unit", 24),
        text(input.title, "Title", 120),
        text(input.eventType, "Event type", 40),
        text(input.findings, "Findings", 8000),
        stamp,
        eventId,
      );
    touchCase(database, caseId, stamp);
    return eventsFor(database, caseId).find((event) => event.id === eventId);
  });
  emitLive({ caseId, kind: "event", action: "update" });
  return updated;
}

export function deleteEvent(caseId: string, eventId: string) {
  const removed = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    database.prepare("UPDATE nodes SET event_id = NULL WHERE event_id = ? AND case_id = ?").run(eventId, caseId);
    const result = database.prepare("DELETE FROM events WHERE id = ? AND case_id = ?").run(eventId, caseId);
    if (!result.changes) throw new HttpError("Event not found.", 404);
    touchCase(database, caseId);
    return { ok: true };
  });
  emitLive({ caseId, kind: "event", action: "delete" });
  return removed;
}

type NodeRow = {
  id: string;
  case_id: string;
  kind: NodeKind;
  pos_x: number;
  pos_y: number;
  payload: string;
  event_id: string | null;
  updated_at: string;
};

type PhotoRow = {
  id: string;
  node_id: string;
  filename: string;
  original_name: string;
  mime: string;
  size: number;
  created_at: string;
};

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    originalName: row.original_name,
    mime: row.mime,
    size: row.size,
    createdAt: row.created_at,
  };
}

function mapNode(row: NodeRow, photos: Photo[]): GraphNode {
  const payload = parsePayload(row.kind, JSON.parse(row.payload));
  const base = { id: row.id, x: row.pos_x, y: row.pos_y, photos, updatedAt: row.updated_at };
  if (row.kind === "case") return { ...base, kind: "case", payload: payload as CasePayload };
  if (row.kind === "suspect") return { ...base, kind: "suspect", payload: payload as SuspectPayload };
  if (row.kind === "evidence") {
    return { ...base, kind: "evidence", eventId: row.event_id, payload: payload as EvidencePayload };
  }
  return { ...base, kind: "related", payload: payload as RelatedPayload };
}

function graphFrom(database: DatabaseSync, caseId: string): GraphData {
  mustCase(caseId, database);
  const nodes = database
    .prepare(
      "SELECT id, case_id, kind, pos_x, pos_y, payload, event_id, updated_at FROM nodes WHERE case_id = ? ORDER BY created_at ASC",
    )
    .all(caseId) as NodeRow[];
  const photos = database
    .prepare(
      `SELECT p.id, p.node_id, p.filename, p.original_name, p.mime, p.size, p.created_at
       FROM photos p JOIN nodes n ON n.id = p.node_id
       WHERE n.case_id = ?
       ORDER BY p.created_at ASC`,
    )
    .all(caseId) as PhotoRow[];
  const byNode = new Map<string, Photo[]>();
  for (const photo of photos) {
    const list = byNode.get(photo.node_id) ?? [];
    list.push(mapPhoto(photo));
    byNode.set(photo.node_id, list);
  }
  const edges = database
    .prepare(
      `SELECT id, source_id, target_id, source_handle, target_handle, label
       FROM edges WHERE case_id = ? ORDER BY created_at ASC`,
    )
    .all(caseId) as {
    id: string;
    source_id: string;
    target_id: string;
    source_handle: string | null;
    target_handle: string | null;
    label: string;
  }[];
  return {
    nodes: nodes.map((node) => mapNode(node, byNode.get(node.id) ?? [])),
    edges: edges.map(
      (edge): GraphEdge => ({
        id: edge.id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        sourceHandle: edge.source_handle,
        targetHandle: edge.target_handle,
        label: edge.label,
      }),
    ),
  };
}

export function getGraph(caseId: string): GraphData {
  return graphFrom(getDb(), caseId);
}

function mustNode(database: DatabaseSync, nodeId: string) {
  const row = database
    .prepare("SELECT id, case_id, kind, pos_x, pos_y, payload, event_id, updated_at FROM nodes WHERE id = ?")
    .get(nodeId) as NodeRow | undefined;
  if (!row) throw new HttpError("Node not found.", 404);
  return row;
}

function evidenceEventId(database: DatabaseSync, caseId: string, eventId: string | null | undefined) {
  if (!eventId) return null;
  const match = database.prepare("SELECT id FROM events WHERE id = ? AND case_id = ?").get(eventId, caseId);
  if (!match) throw new HttpError("That event is not on this case.", 400);
  return eventId;
}

export function createNode(
  caseId: string,
  input: { kind: NodeKind; payload: unknown; linkTo?: string | null; linkLabel?: string | null; eventId?: string | null },
) {
  if (input.kind !== "suspect" && input.kind !== "evidence" && input.kind !== "related") {
    throw new HttpError("Choose a suspect, evidence item, or related item.", 400);
  }
  const graph = transaction((database) => {
    const existing = mustCase(caseId, database);
    assertMutable(existing);
    const position = placeNode(database, caseId, input.kind);
    const raw = asRecord(input.payload);
    if (input.kind === "evidence" && !text(raw.tag ?? "", "Evidence tag", 40, false)) {
      raw.tag = nextEvidenceTag(database, caseId, existing.case_number);
    }
    if (input.kind === "suspect" && !raw.status) raw.status = "person_of_interest";
    if (input.kind === "evidence" && !raw.category) raw.category = "other";
    const payload = parsePayload(input.kind, raw);
    const eventId = input.kind === "evidence" ? evidenceEventId(database, caseId, input.eventId) : null;
    const id = randomUUID();
    const stamp = nowIso();
    database
      .prepare(
        "INSERT INTO nodes (id, case_id, kind, pos_x, pos_y, payload, event_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(id, caseId, input.kind, position.x, position.y, JSON.stringify(payload), eventId, stamp, stamp);

    const anchorId = input.linkTo?.trim() || rootId(database, caseId);
    const anchor = mustNode(database, anchorId);
    if (anchor.case_id !== caseId) throw new HttpError("Link the node inside this case.", 400);
    const label = text(input.linkLabel?.trim() || defaultLinkLabel(input.kind), "Relationship", 80);
    database
      .prepare(
        `INSERT INTO edges (id, case_id, source_id, target_id, source_handle, target_handle, label, created_at)
         VALUES (?, ?, ?, ?, 'b', 't', ?, ?)`,
      )
      .run(randomUUID(), caseId, anchor.id, id, label, stamp);
    touchCase(database, caseId, stamp);
    return graphFrom(database, caseId);
  });
  emitLive({ caseId, kind: "node", action: "create" });
  return graph;
}

export function updateNode(nodeId: string, patch: { payload?: unknown; x?: number; y?: number; eventId?: string | null }) {
  const rowBefore = mustNode(getDb(), nodeId);
  const movedOnly = patch.payload === undefined && patch.eventId === undefined;
  const updated = transaction((database) => {
    const row = mustNode(database, nodeId);
    assertMutable(mustCase(row.case_id, database));
    let payload = JSON.parse(row.payload) as unknown;
    if (patch.payload !== undefined) {
      if (row.kind === "case") throw new HttpError("Edit the case file to change the incident root.", 400);
      payload = parsePayload(row.kind, { ...asRecord(payload), ...asRecord(patch.payload) });
    }
    const x = patch.x === undefined ? row.pos_x : Number(patch.x);
    const y = patch.y === undefined ? row.pos_y : Number(patch.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new HttpError("Position is invalid.", 400);
    const stamp = nowIso();
    if (patch.eventId !== undefined) {
      if (row.kind !== "evidence") throw new HttpError("Only evidence can be tied to an event.", 400);
      const eventId = evidenceEventId(database, row.case_id, patch.eventId);
      database
        .prepare("UPDATE nodes SET payload = ?, pos_x = ?, pos_y = ?, event_id = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(payload), x, y, eventId, stamp, nodeId);
    } else {
      database
        .prepare("UPDATE nodes SET payload = ?, pos_x = ?, pos_y = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(payload), x, y, stamp, nodeId);
    }
    touchCase(database, row.case_id, stamp);
    return { ok: true };
  });
  emitLive({ caseId: rowBefore.case_id, kind: movedOnly ? "positions" : "node", action: "update" });
  return updated;
}

export function savePositions(caseId: string, positions: { id: string; x: number; y: number }[]) {
  const saved = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const stamp = nowIso();
    const update = database.prepare(
      "UPDATE nodes SET pos_x = ?, pos_y = ?, updated_at = ? WHERE id = ? AND case_id = ?",
    );
    for (const position of positions) {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new HttpError("Position is invalid.", 400);
      }
      const result = update.run(position.x, position.y, stamp, position.id, caseId);
      if (!result.changes) throw new HttpError("One of those nodes is not on this case.", 400);
    }
    touchCase(database, caseId, stamp);
    return { ok: true };
  });
  emitLive({ caseId, kind: "positions", action: "update" });
  return saved;
}

function resolvedUpload(filename: string) {
  const root = path.resolve(uploadDir());
  const full = path.resolve(root, filename);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    throw new HttpError("Photo not found.", 404);
  }
  return full;
}

function unlinkUpload(filename: string) {
  fs.rmSync(resolvedUpload(filename), { force: true });
}

export function deleteNode(nodeId: string) {
  const database = getDb();
  const row = mustNode(database, nodeId);
  if (row.kind === "case") throw new HttpError("The case root stays on the chart.", 400);
  assertMutable(mustCase(row.case_id, database));
  const photos = database.prepare("SELECT filename FROM photos WHERE node_id = ?").all(nodeId) as { filename: string }[];
  transaction((tx) => {
    tx.prepare("DELETE FROM nodes WHERE id = ?").run(nodeId);
    touchCase(tx, row.case_id);
  });
  for (const photo of photos) unlinkUpload(photo.filename);
  emitLive({ caseId: row.case_id, kind: "node", action: "delete" });
  return { ok: true };
}

export function createEdge(
  caseId: string,
  input: { sourceId: string; targetId: string; label?: string; sourceHandle?: string | null; targetHandle?: string | null },
) {
  const edge = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const source = mustNode(database, input.sourceId);
    const target = mustNode(database, input.targetId);
    if (source.case_id !== caseId || target.case_id !== caseId) {
      throw new HttpError("Both nodes must belong to this case.", 400);
    }
    if (source.id === target.id) throw new HttpError("A node cannot link to itself.", 400);
    const label = text(input.label ?? "Associated With", "Relationship", 80);
    const duplicate = database
      .prepare("SELECT id FROM edges WHERE case_id = ? AND source_id = ? AND target_id = ? AND label = ?")
      .get(caseId, source.id, target.id, label);
    if (duplicate) throw new HttpError("That relationship is already on the chart.", 409);
    const id = randomUUID();
    database
      .prepare(
        `INSERT INTO edges (id, case_id, source_id, target_id, source_handle, target_handle, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        caseId,
        source.id,
        target.id,
        input.sourceHandle || "b",
        input.targetHandle || "t",
        label,
        nowIso(),
      );
    touchCase(database, caseId);
    return {
      id,
      sourceId: source.id,
      targetId: target.id,
      sourceHandle: input.sourceHandle || "b",
      targetHandle: input.targetHandle || "t",
      label,
    } satisfies GraphEdge;
  });
  emitLive({ caseId, kind: "edge", action: "create" });
  return edge;
}

export function updateEdge(caseId: string, edgeId: string, label: string) {
  const updated = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const clean = text(label, "Relationship", 80);
    const result = database
      .prepare("UPDATE edges SET label = ? WHERE id = ? AND case_id = ?")
      .run(clean, edgeId, caseId);
    if (!result.changes) throw new HttpError("Relationship not found.", 404);
    touchCase(database, caseId);
    return { id: edgeId, label: clean };
  });
  emitLive({ caseId, kind: "edge", action: "update" });
  return updated;
}

export function deleteEdge(caseId: string, edgeId: string) {
  const removed = transaction((database) => {
    assertMutable(mustCase(caseId, database));
    const result = database.prepare("DELETE FROM edges WHERE id = ? AND case_id = ?").run(edgeId, caseId);
    if (!result.changes) throw new HttpError("Relationship not found.", 404);
    touchCase(database, caseId);
    return { ok: true };
  });
  emitLive({ caseId, kind: "edge", action: "delete" });
  return removed;
}

const ALLOWED_MIME = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function sniff(buffer: Buffer, mime: string) {
  if (mime === "image/jpeg") return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/gif") {
    const head = buffer.subarray(0, 6).toString("ascii");
    return head === "GIF87a" || head === "GIF89a";
  }
  if (mime === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function addPhotos(nodeId: string, files: File[]) {
  if (!files.length) throw new HttpError("Choose at least one photo.", 400);
  if (files.length > 8) throw new HttpError("Upload up to 8 photos at a time.", 400);
  const database = getDb();
  const node = mustNode(database, nodeId);
  assertMutable(mustCase(node.case_id, database));
  const existing = database.prepare("SELECT COUNT(*) AS count FROM photos WHERE node_id = ?").get(nodeId) as {
    count: number;
  };
  if (Number(existing.count) + files.length > 12) {
    throw new HttpError("A node can hold 12 photos.", 400);
  }

  const stored: { id: string; filename: string; originalName: string; mime: string; size: number }[] = [];
  try {
    for (const file of files) {
      const mime = file.type.toLowerCase();
      const extension = ALLOWED_MIME.get(mime);
      if (!extension) throw new HttpError("Photos must be JPEG, PNG, WEBP, or GIF.", 400);
      if (file.size > 8 * 1024 * 1024) throw new HttpError("Each photo must be 8 MB or smaller.", 400);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!sniff(bytes, mime)) throw new HttpError("That file does not match an allowed image type.", 400);
      const id = randomUUID();
      const filename = `${id}${extension}`;
      fs.writeFileSync(path.join(uploadDir(), filename), bytes);
      stored.push({
        id,
        filename,
        originalName: path.basename(file.name || "photo").slice(0, 120) || "photo",
        mime,
        size: bytes.length,
      });
    }
    transaction((tx) => {
      const stamp = nowIso();
      const insert = tx.prepare(
        "INSERT INTO photos (id, node_id, filename, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      for (const photo of stored) {
        insert.run(photo.id, nodeId, photo.filename, photo.originalName, photo.mime, photo.size, stamp);
      }
      tx.prepare("UPDATE nodes SET updated_at = ? WHERE id = ?").run(stamp, nodeId);
      touchCase(tx, node.case_id, stamp);
    });
    emitLive({ caseId: node.case_id, kind: "photo", action: "create" });
  } catch (error) {
    for (const photo of stored) unlinkUpload(photo.filename);
    throw error;
  }

  const photos = database
    .prepare(
      "SELECT id, node_id, filename, original_name, mime, size, created_at FROM photos WHERE node_id = ? ORDER BY created_at ASC",
    )
    .all(nodeId) as PhotoRow[];
  return { photos: photos.map(mapPhoto) };
}

export function getPhotoFile(id: string) {
  const row = getDb()
    .prepare("SELECT id, filename, original_name, mime FROM photos WHERE id = ?")
    .get(id) as { id: string; filename: string; original_name: string; mime: string } | undefined;
  if (!row) throw new HttpError("Photo not found.", 404);
  const full = resolvedUpload(row.filename);
  if (!fs.existsSync(full)) throw new HttpError("Photo not found.", 404);
  return { path: full, mime: row.mime, name: row.original_name };
}

export function deletePhoto(photoId: string) {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT p.filename, p.node_id, n.case_id
       FROM photos p JOIN nodes n ON n.id = p.node_id
       WHERE p.id = ?`,
    )
    .get(photoId) as { filename: string; node_id: string; case_id: string } | undefined;
  if (!row) throw new HttpError("Photo not found.", 404);
  assertMutable(mustCase(row.case_id, database));
  transaction((tx) => {
    tx.prepare("DELETE FROM photos WHERE id = ?").run(photoId);
    touchCase(tx, row.case_id);
  });
  unlinkUpload(row.filename);
  emitLive({ caseId: row.case_id, kind: "photo", action: "delete" });
  return { ok: true };
}

export function nodeCase(nodeId: string) {
  const row = mustNode(getDb(), nodeId);
  return { node: row, caseRow: mustCase(row.case_id) };
}
