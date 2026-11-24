"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Inspector } from "@/components/case/inspector";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/client";
import { EVIDENCE_CATEGORIES, EVENT_TYPES, SUSPECT_STATUSES, evidenceCategoryLabel, suspectStatusLabel } from "@/lib/constants";
import { formatWhen, toDatetimeLocal } from "@/lib/format";
import { can } from "@/lib/permissions";
import type {
  CaseDetail,
  CaseEvent,
  EvidenceCategory,
  EvidencePayload,
  GraphData,
  GraphEdge,
  GraphNode,
  SuspectPayload,
  SuspectStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftEvent = {
  occurredAt: string;
  badge: string;
  unit: string;
  title: string;
  eventType: string;
  findings: string;
};

function tally(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase() || "?";
}

function edgeTouches(edge: GraphEdge, left: string, right: string) {
  return (edge.sourceId === left && edge.targetId === right) || (edge.sourceId === right && edge.targetId === left);
}

function statusVariant(status: SuspectStatus) {
  if (status === "at_large") return "suspect" as const;
  if (status === "in_custody") return "closed" as const;
  if (status === "person_of_interest") return "open" as const;
  return "evidence" as const;
}

function Column({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number | null;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[240px] min-w-0 flex-col border-b border-white/8 md:min-h-0 md:border-b-0 md:border-r md:last:border-r-0">
      <header className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{title}</h2>
          {count !== null ? <span className="font-mono text-[10px] text-fog">{count}</span> : null}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{children}</div>
    </section>
  );
}

function Quiet({ children }: { children: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-5 text-center">
      <span className="mb-3 h-px w-8 bg-gold/50" />
      <p className="max-w-[15rem] text-sm leading-6 text-fog">{children}</p>
    </div>
  );
}

export function InvestigationBoard({
  caseId,
  record,
  graph,
  locked,
  selectedEventId,
  onSelectEvent,
  onGraph,
  onRecord,
}: {
  caseId: string;
  record: CaseDetail;
  graph: GraphData;
  locked: boolean;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  onGraph: (graph: GraphData) => void;
  onRecord: (record: CaseDetail) => void;
}) {
  const { role, badge } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suspectOpen, setSuspectOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existingSuspect, setExistingSuspect] = useState("");
  const [existingEvidence, setExistingEvidence] = useState("");
  const [suspectDraft, setSuspectDraft] = useState({ name: "", alias: "", status: "person_of_interest" as SuspectStatus });
  const [evidenceDraft, setEvidenceDraft] = useState({ category: "other" as EvidenceCategory, description: "" });
  const [eventDraft, setEventDraft] = useState<DraftEvent>({
    occurredAt: toDatetimeLocal(),
    badge,
    unit: "",
    title: "",
    eventType: "Observation",
    findings: "",
  });

  const canSuspect = !locked && can(role, "suspect:create");
  const canEvidence = !locked && can(role, "evidence:create");
  const canLink = !locked && can(role, "node:link");
  const canEvent = !locked && can(role, "event:create");

  useEffect(() => {
    setSelectedId(null);
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
  }, [graph.nodes, selectedId]);

  useEffect(() => {
    if (!selectedEventId) return;
    document.getElementById(`board-event-${selectedEventId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedEventId]);

  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);

  const eventCounts = useMemo(() => {
    const counts = new Map<string, { suspects: number; evidence: number }>();
    for (const link of graph.eventLinks) {
      const kind = nodesById.get(link.nodeId)?.kind;
      const current = counts.get(link.eventId) ?? { suspects: 0, evidence: 0 };
      if (kind === "suspect") current.suspects += 1;
      if (kind === "evidence") current.evidence += 1;
      counts.set(link.eventId, current);
    }
    return counts;
  }, [graph.eventLinks, nodesById]);

  const activeLinks = graph.eventLinks.filter((link) => link.eventId === selectedEventId);
  const suspects = activeLinks
    .map((link) => nodesById.get(link.nodeId))
    .filter((node): node is Extract<GraphNode, { kind: "suspect" }> => node?.kind === "suspect");
  const evidence = activeLinks
    .map((link) => nodesById.get(link.nodeId))
    .filter((node): node is Extract<GraphNode, { kind: "evidence" }> => node?.kind === "evidence");

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const highlighted = useMemo(() => {
    if (!selected || (selected.kind !== "suspect" && selected.kind !== "evidence")) return new Set<string>();
    const want = selected.kind === "suspect" ? "evidence" : "suspect";
    const ids = new Set<string>();
    for (const edge of graph.edges) {
      const otherId = edge.sourceId === selected.id ? edge.targetId : edge.targetId === selected.id ? edge.sourceId : null;
      if (!otherId) continue;
      if (nodesById.get(otherId)?.kind === want) ids.add(otherId);
    }
    return ids;
  }, [graph.edges, nodesById, selected]);

  const suspectPool = graph.nodes.filter(
    (node): node is Extract<GraphNode, { kind: "suspect" }> =>
      node.kind === "suspect" && !suspects.some((item) => item.id === node.id),
  );
  const evidencePool = graph.nodes.filter(
    (node): node is Extract<GraphNode, { kind: "evidence" }> =>
      node.kind === "evidence" && !evidence.some((item) => item.id === node.id),
  );

  function joined(leftId: string, rightId: string) {
    return graph.edges.some((edge) => edgeTouches(edge, leftId, rightId));
  }

  function chooseEvent(id: string) {
    onSelectEvent(selectedEventId === id ? null : id);
  }

  async function createSuspect() {
    if (!selectedEventId) return;
    if (!suspectDraft.name.trim()) {
      toast.error("Name the suspect.");
      return;
    }
    setBusy(true);
    try {
      const next = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          kind: "suspect",
          payload: { name: suspectDraft.name.trim(), alias: suspectDraft.alias.trim(), status: suspectDraft.status, notes: "" },
          eventId: selectedEventId,
        }),
      });
      onGraph(next);
      const created = next.nodes.find((node) => node.kind === "suspect" && !graph.nodes.some((item) => item.id === node.id));
      if (created) setSelectedId(created.id);
      setSuspectOpen(false);
      toast.success("Suspect linked to this event.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The suspect was not added.");
    } finally {
      setBusy(false);
    }
  }

  async function linkSuspect() {
    if (!selectedEventId || !existingSuspect) {
      toast.error("Choose a suspect to link.");
      return;
    }
    setBusy(true);
    try {
      onGraph(
        await api<GraphData>(`/api/cases/${caseId}/event-links`, {
          method: "POST",
          body: JSON.stringify({ eventId: selectedEventId, nodeId: existingSuspect, label: "Suspect In" }),
        }),
      );
      setSuspectOpen(false);
      toast.success("Suspect linked to this event.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The suspect was not linked.");
    } finally {
      setBusy(false);
    }
  }

  async function createEvidence() {
    if (!selectedEventId) return;
    if (!evidenceDraft.description.trim()) {
      toast.error("Describe the evidence.");
      return;
    }
    setBusy(true);
    try {
      const next = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          kind: "evidence",
          payload: { tag: "", category: evidenceDraft.category, description: evidenceDraft.description.trim(), custody: "", notes: "" },
          eventId: selectedEventId,
        }),
      });
      onGraph(next);
      const created = next.nodes.find((node) => node.kind === "evidence" && !graph.nodes.some((item) => item.id === node.id));
      if (created) setSelectedId(created.id);
      setEvidenceOpen(false);
      toast.success("Evidence linked to this event.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The evidence was not added.");
    } finally {
      setBusy(false);
    }
  }

  async function linkEvidence() {
    if (!selectedEventId || !existingEvidence) {
      toast.error("Choose an evidence item to link.");
      return;
    }
    setBusy(true);
    try {
      onGraph(
        await api<GraphData>(`/api/cases/${caseId}/event-links`, {
          method: "POST",
          body: JSON.stringify({ eventId: selectedEventId, nodeId: existingEvidence, label: "Recovered At" }),
        }),
      );
      setEvidenceOpen(false);
      toast.success("Evidence linked to this event.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The evidence was not linked.");
    } finally {
      setBusy(false);
    }
  }

  async function createEvent() {
    if (!eventDraft.title.trim() || !eventDraft.unit.trim() || !eventDraft.badge.trim() || !eventDraft.findings.trim()) {
      toast.error("Complete the event before logging it.");
      return;
    }
    const when = new Date(eventDraft.occurredAt);
    if (Number.isNaN(when.getTime())) {
      toast.error("Enter a valid date and time.");
      return;
    }
    setBusy(true);
    try {
      const created = await api<CaseEvent>(`/api/cases/${caseId}/events`, {
        method: "POST",
        body: JSON.stringify({
          occurredAt: when.toISOString(),
          badge: eventDraft.badge,
          unit: eventDraft.unit,
          title: eventDraft.title,
          eventType: eventDraft.eventType,
          findings: eventDraft.findings,
        }),
      });
      onRecord(await api<CaseDetail>(`/api/cases/${caseId}`));
      onSelectEvent(created.id);
      setEventOpen(false);
      toast.success("Event logged.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The event was not logged.");
    } finally {
      setBusy(false);
    }
  }

  const suspectAction =
    selectedEventId && (canSuspect || canLink) ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          setSuspectDraft({ name: "", alias: "", status: "person_of_interest" });
          setExistingSuspect("");
          setSuspectOpen(true);
        }}
      >
        <Plus /> Add suspect
      </Button>
    ) : null;

  const evidenceAction =
    selectedEventId && (canEvidence || canLink) ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          setEvidenceDraft({ category: "other", description: "" });
          setExistingEvidence("");
          setEvidenceOpen(true);
        }}
      >
        <Plus /> Add evidence
      </Button>
    ) : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#0b1016]">
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-3">
        <Column title="Suspects" count={selectedEventId ? suspects.length : null} action={suspectAction}>
          {!selectedEventId ? (
            <Quiet>Select an event to view linked suspects</Quiet>
          ) : suspects.length === 0 ? (
            <Quiet>No suspects linked to this event.</Quiet>
          ) : (
            <ul key={selectedEventId} className="space-y-2">
              {suspects.map((node, index) => {
                const payload = node.payload as SuspectPayload;
                const photo = node.photos[0];
                const pills = evidence.filter((item) => joined(node.id, item.id));
                const open = selectedId === node.id;
                const linked = highlighted.has(node.id);
                return (
                  <li key={node.id} className="board-rise" style={{ animationDelay: `${index * 42}ms` }}>
                    <button
                      type="button"
                      data-testid="suspect-card"
                      onClick={() => setSelectedId(node.id)}
                      className={cn(
                        "w-full rounded-lg border bg-ink/90 p-2.5 text-left transition",
                        open
                          ? "border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.35),0_0_22px_rgba(212,175,55,0.16)]"
                          : linked
                            ? "border-signal-cyan/70 shadow-[0_0_18px_rgba(59,201,219,0.16)]"
                            : "border-white/10 hover:border-white/25",
                      )}
                    >
                      <span className="flex gap-2.5">
                        <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-white/10">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/photos/${photo.id}`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-display text-lg tracking-wide text-gold">{initials(payload.name)}</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{payload.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-fog">
                            {payload.alias ? `Alias ${payload.alias}` : "No alias on file"}
                          </span>
                          <Badge variant={statusVariant(payload.status)} className="mt-1.5">
                            {suspectStatusLabel(payload.status)}
                          </Badge>
                        </span>
                      </span>
                      {pills.length ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {pills.map((item) => (
                            <span key={item.id} className="rounded-full bg-signal-cyan/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-signal-cyan">
                              {(item.payload as EvidencePayload).tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Column>

        <Column
          title="Events"
          count={record.events.length}
          action={
            canEvent ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEventDraft({
                    occurredAt: toDatetimeLocal(),
                    badge,
                    unit: "",
                    title: "",
                    eventType: "Observation",
                    findings: "",
                  });
                  setEventOpen(true);
                }}
              >
                <Plus /> Add event
              </Button>
            ) : null
          }
        >
          {record.events.length === 0 ? (
            <Quiet>No events logged on this case.</Quiet>
          ) : (
            <ol className="space-y-2">
              {record.events.map((event, index) => {
                const counts = eventCounts.get(event.id) ?? { suspects: 0, evidence: 0 };
                const active = selectedEventId === event.id;
                return (
                  <li key={event.id}>
                    <button
                      id={`board-event-${event.id}`}
                      type="button"
                      data-testid="event-card"
                      aria-pressed={active}
                      onClick={() => chooseEvent(event.id)}
                      className={cn(
                        "w-full rounded-lg border bg-ink/90 p-3 text-left transition",
                        active
                          ? "border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.5),0_0_26px_rgba(212,175,55,0.2)]"
                          : "border-white/10 hover:border-white/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                          {index === 0 ? "Main Event" : `Event ${index + 1}`}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-fog">
                          {event.eventType}
                        </span>
                      </span>
                      <span className="mt-1.5 block font-mono text-[11px] text-gold-bright">{formatWhen(event.occurredAt)}</span>
                      <span className="mt-1 block text-sm font-medium leading-5">{event.title}</span>
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-fog">
                        {event.badge} · {event.unit}
                      </span>
                      <span className="mt-2 inline-flex rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-fog">
                        {tally(counts.suspects, "suspect", "suspects")} · {tally(counts.evidence, "evidence", "evidence")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Column>

        <Column title="Evidence" count={selectedEventId ? evidence.length : null} action={evidenceAction}>
          {!selectedEventId ? (
            <Quiet>Select an event to view linked evidence</Quiet>
          ) : evidence.length === 0 ? (
            <Quiet>No evidence linked to this event.</Quiet>
          ) : (
            <ul key={`evidence-${selectedEventId}`} className="space-y-2">
              {evidence.map((node, index) => {
                const payload = node.payload as EvidencePayload;
                const photo = node.photos[0];
                const people = suspects.filter((item) => joined(node.id, item.id));
                const open = selectedId === node.id;
                const linked = highlighted.has(node.id);
                return (
                  <li key={node.id} className="board-rise" style={{ animationDelay: `${index * 42}ms` }}>
                    <button
                      type="button"
                      data-testid="evidence-card"
                      onClick={() => setSelectedId(node.id)}
                      className={cn(
                        "w-full rounded-lg border bg-ink/90 p-2.5 text-left transition",
                        open
                          ? "border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.35),0_0_22px_rgba(212,175,55,0.16)]"
                          : linked
                            ? "border-signal-cyan/70 shadow-[0_0_18px_rgba(59,201,219,0.16)]"
                            : "border-white/10 hover:border-white/25",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-xs tracking-wide text-gold-bright">{payload.tag}</span>
                        <Badge variant="evidence">{evidenceCategoryLabel(payload.category)}</Badge>
                      </span>
                      <span className="mt-2 flex gap-2.5">
                        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-white/[0.04] ring-1 ring-white/10">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/api/photos/${photo.id}`} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="px-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-fog">No photo</span>
                          )}
                        </span>
                        <span className="line-clamp-3 text-sm leading-5 text-foreground/90">{payload.description || "No description."}</span>
                      </span>
                      {people.length ? (
                        <span className="mt-2 flex flex-wrap gap-1">
                          {people.map((item) => (
                            <span key={item.id} className="rounded-full border border-status-crimson/30 bg-status-crimson/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-status-crimson">
                              {(item.payload as SuspectPayload).name}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Column>
      </div>

      {selected ? (
        <Inspector
          caseId={caseId}
          node={selected}
          nodes={graph.nodes}
          edges={graph.edges}
          events={record.events}
          eventLinks={graph.eventLinks}
          locked={locked}
          onClose={() => setSelectedId(null)}
          onGraph={onGraph}
          onFocus={setSelectedId}
        />
      ) : null}

      <Dialog open={suspectOpen} onOpenChange={setSuspectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add suspect</DialogTitle>
          </DialogHeader>
          {canSuspect ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-suspect-name">Name</Label>
                <Input id="new-suspect-name" value={suspectDraft.name} onChange={(event) => setSuspectDraft({ ...suspectDraft, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-suspect-alias">Alias</Label>
                <Input id="new-suspect-alias" value={suspectDraft.alias} onChange={(event) => setSuspectDraft({ ...suspectDraft, alias: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={suspectDraft.status} onValueChange={(status) => setSuspectDraft({ ...suspectDraft, status: status as SuspectStatus })}>
                  <SelectTrigger aria-label="New suspect status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUSPECT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          {canLink && suspectPool.length ? (
            <div className="space-y-2 border-t border-white/8 pt-3">
              <Label>Link an existing suspect</Label>
              <Select value={existingSuspect || undefined} onValueChange={setExistingSuspect}>
                <SelectTrigger aria-label="Existing suspect"><SelectValue placeholder="Choose a case suspect" /></SelectTrigger>
                <SelectContent>
                  {suspectPool.map((node) => (
                    <SelectItem key={node.id} value={node.id}>{(node.payload as SuspectPayload).name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSuspectOpen(false)}>Cancel</Button>
            {canLink && existingSuspect ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void linkSuspect()}>Link selected</Button>
            ) : null}
            {canSuspect ? (
              <Button type="button" disabled={busy} onClick={() => void createSuspect()}>{busy ? "Saving" : "Create and link"}</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add evidence</DialogTitle>
          </DialogHeader>
          {canEvidence ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={evidenceDraft.category} onValueChange={(category) => setEvidenceDraft({ ...evidenceDraft, category: category as EvidenceCategory })}>
                  <SelectTrigger aria-label="New evidence category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVIDENCE_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-evidence-description">Description</Label>
                <Textarea id="new-evidence-description" value={evidenceDraft.description} onChange={(event) => setEvidenceDraft({ ...evidenceDraft, description: event.target.value })} />
              </div>
              <p className="text-xs text-fog">The evidence tag is assigned when the item is booked, and it is linked to the selected event.</p>
            </div>
          ) : null}
          {canLink && evidencePool.length ? (
            <div className="space-y-2 border-t border-white/8 pt-3">
              <Label>Link an existing item</Label>
              <Select value={existingEvidence || undefined} onValueChange={setExistingEvidence}>
                <SelectTrigger aria-label="Existing evidence"><SelectValue placeholder="Choose evidence on this case" /></SelectTrigger>
                <SelectContent>
                  {evidencePool.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {(node.payload as EvidencePayload).tag} · {(node.payload as EvidencePayload).description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEvidenceOpen(false)}>Cancel</Button>
            {canLink && existingEvidence ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void linkEvidence()}>Link selected</Button>
            ) : null}
            {canEvidence ? (
              <Button type="button" disabled={busy} onClick={() => void createEvidence()}>{busy ? "Saving" : "Create and link"}</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventOpen} onOpenChange={setEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-event-time">Date and time</Label>
                <Input id="new-event-time" type="datetime-local" value={eventDraft.occurredAt} onChange={(event) => setEventDraft({ ...eventDraft, occurredAt: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={eventDraft.eventType} onValueChange={(eventType) => setEventDraft({ ...eventDraft, eventType })}>
                  <SelectTrigger aria-label="New event type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-event-badge">Badge</Label>
                <Input id="new-event-badge" className="font-mono" value={eventDraft.badge} onChange={(event) => setEventDraft({ ...eventDraft, badge: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-event-unit">Unit</Label>
                <Input id="new-event-unit" className="font-mono" value={eventDraft.unit} onChange={(event) => setEventDraft({ ...eventDraft, unit: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-event-title">Title</Label>
              <Input id="new-event-title" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-event-findings">Findings</Label>
              <Textarea id="new-event-findings" value={eventDraft.findings} onChange={(event) => setEventDraft({ ...eventDraft, findings: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEventOpen(false)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void createEvent()}>{busy ? "Saving" : "Log event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
