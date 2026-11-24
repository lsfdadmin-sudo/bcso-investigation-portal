"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/session";
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
import { EVENT_TYPES, INCIDENT_TYPES, RESPONDER_ROLES } from "@/lib/constants";
import { api, ApiError } from "@/lib/client";
import { formatWhen, toDatetimeLocal } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { CaseDetail, CaseEvent, Responder } from "@/lib/types";

function blankResponder(): Responder {
  return { id: "", badge: "", callsign: "", name: "", role: "Primary" };
}

export function IncidentFile({
  record,
  onRecord,
  activeEventId,
  expandedEventIds,
  expandAllEvidence,
  evidenceCounts,
  onRevealEvent,
}: {
  record: CaseDetail;
  onRecord: (record: CaseDetail) => void;
  activeEventId: string | null;
  expandedEventIds: string[];
  expandAllEvidence: boolean;
  evidenceCounts: Record<string, number>;
  onRevealEvent: (eventId: string) => void;
}) {
  const { role, badge } = useSession();
  const locked = record.status === "closed";
  const canEdit = !locked && can(role, "case:edit");
  const canAddEvent = !locked && can(role, "event:create");
  const canEditEvent = !locked && can(role, "event:edit");
  const canDeleteEvent = !locked && can(role, "event:delete");
  const canDeleteCase = can(role, "case:delete");

  const [narrative, setNarrative] = useState(record.narrative);
  const [narrativeState, setNarrativeState] = useState<"saved" | "saving" | "unsaved">("saved");
  const narrativeDirty = useRef(false);
  const narrativeRef = useRef(narrative);
  narrativeRef.current = narrative;
  const rosterCase = useRef(record.id);
  const [responders, setResponders] = useState<Responder[]>(record.responders);
  const [rosterDirty, setRosterDirty] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [incidentType, setIncidentType] = useState(record.incidentType);
  const [customType, setCustomType] = useState("");
  const [location, setLocation] = useState(record.location);
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal(record.occurredAt));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    occurredAt: toDatetimeLocal(),
    badge,
    unit: "",
    title: "",
    eventType: "Observation",
    findings: "",
  });

  useEffect(() => {
    if (rosterCase.current !== record.id) {
      rosterCase.current = record.id;
      setRosterDirty(false);
      setResponders(record.responders);
      return;
    }
    if (!rosterDirty) setResponders(record.responders);
  }, [record.id, record.responders, rosterDirty]);

  useEffect(() => {
    if (narrativeDirty.current && canEdit) return;
    setNarrative(record.narrative);
    if (!narrativeDirty.current) setNarrativeState("saved");
  }, [record.id, record.narrative, canEdit]);

  useEffect(() => {
    if (!canEdit || !narrativeDirty.current) return;
    if (narrative === record.narrative) {
      narrativeDirty.current = false;
      setNarrativeState("saved");
      return;
    }
    setNarrativeState("unsaved");
    const snapshot = narrative;
    const timer = window.setTimeout(async () => {
      setNarrativeState("saving");
      try {
        const updated = await api<CaseDetail>(`/api/cases/${record.id}`, {
          method: "PATCH",
          body: JSON.stringify({ narrative: snapshot }),
        });
        if (narrativeRef.current === snapshot) narrativeDirty.current = false;
        onRecord(updated);
        setNarrativeState(narrativeRef.current === snapshot ? "saved" : "unsaved");
      } catch (error) {
        setNarrativeState("unsaved");
        toast.error(error instanceof ApiError ? error.message : "The narrative was not saved.");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [narrative, canEdit, record.id, record.narrative, onRecord]);

  async function saveDetails() {
    const type = incidentType === "Other" ? customType.trim() : incidentType;
    try {
      const updated = await api<CaseDetail>(`/api/cases/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          incidentType: type,
          location,
          occurredAt: new Date(occurredAt).toISOString(),
        }),
      });
      onRecord(updated);
      setDetailsOpen(false);
      toast.success("Case details saved.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Details were not saved.");
    }
  }

  async function saveRoster() {
    const filled = responders.filter((row) => row.badge || row.callsign || row.name);
    if (filled.some((row) => !row.badge || !row.callsign || !row.name || !row.role)) {
      toast.error("Complete every responder row, or clear it.");
      return;
    }
    try {
      await api(`/api/cases/${record.id}/responders`, {
        method: "PUT",
        body: JSON.stringify({ responders: filled }),
      });
      const updated = await api<CaseDetail>(`/api/cases/${record.id}`);
      setRosterDirty(false);
      onRecord(updated);
      toast.success("Initial response saved.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The roster was not saved.");
    }
  }

  async function saveEvent(existing?: CaseEvent) {
    const payload = {
      occurredAt: new Date(draft.occurredAt).toISOString(),
      badge: draft.badge,
      unit: draft.unit,
      title: draft.title,
      eventType: draft.eventType,
      findings: draft.findings,
    };
    try {
      if (existing) {
        await api(`/api/cases/${record.id}/events/${existing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api(`/api/cases/${record.id}/events`, { method: "POST", body: JSON.stringify(payload) });
      }
      onRecord(await api<CaseDetail>(`/api/cases/${record.id}`));
      setAdding(false);
      setEditingId(null);
      toast.success(existing ? "Event updated." : "Event logged.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The event was not saved.");
    }
  }

  async function deleteEvent(eventId: string) {
    try {
      await api(`/api/cases/${record.id}/events/${eventId}`, { method: "DELETE" });
      onRecord(await api<CaseDetail>(`/api/cases/${record.id}`));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The event was not deleted.");
    }
  }

  async function deleteCase() {
    if (!window.confirm("Delete this case and everything attached to it? This cannot be undone.")) return;
    try {
      await api(`/api/cases/${record.id}`, { method: "DELETE" });
      window.location.assign("/board");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The case was not deleted.");
    }
  }

  function startEdit(event: CaseEvent) {
    setEditingId(event.id);
    setAdding(false);
    setDraft({
      occurredAt: toDatetimeLocal(event.occurredAt),
      badge: event.badge,
      unit: event.unit,
      title: event.title,
      eventType: event.eventType,
      findings: event.findings,
    });
  }

  const knownType = INCIDENT_TYPES.includes(record.incidentType as (typeof INCIDENT_TYPES)[number]);

  return (
    <div className="h-full overflow-y-auto bg-[#0c1118]">
      <div className="space-y-8 px-4 py-5 sm:px-6">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Incident narrative</h2>
            {canEdit ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog" aria-live="polite">
                {narrativeState === "saving" ? "Saving" : narrativeState === "unsaved" ? "Unsaved" : "Saved"}
              </span>
            ) : null}
          </div>
          <Textarea
            aria-label="Incident narrative"
            value={narrative}
            readOnly={!canEdit}
            onChange={(event) => {
              narrativeDirty.current = true;
              setNarrative(event.target.value);
            }}
            className="min-h-48 leading-7"
          />
          {!canEdit ? (
            <p className="mt-2 text-xs text-fog">
              {locked ? "This file is closed. Reopen it to edit." : "Narrative edits are reserved for detectives."}
            </p>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setIncidentType(knownType ? record.incidentType : "Other");
                setCustomType(knownType ? "" : record.incidentType);
                setLocation(record.location);
                setOccurredAt(toDatetimeLocal(record.occurredAt));
                setDetailsOpen(true);
              }}
            >
              <Pencil />
              Edit case details
            </Button>
          ) : null}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Initial response</h2>
            {canEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setResponders((rows) => [...rows, blankResponder()]); setRosterDirty(true); }}>
                <Plus /> Add
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-md border border-white/8">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-fog">
                <tr>
                  <th className="px-3 py-2 font-medium">Badge</th>
                  <th className="px-3 py-2 font-medium">Callsign</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  {canEdit ? <th className="px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {responders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-fog">No units recorded.</td>
                  </tr>
                ) : null}
                {responders.map((row, index) => (
                  <tr key={row.id || index} className="border-t border-white/6">
                    {(["badge", "callsign", "name"] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        {canEdit ? (
                          <Input
                            aria-label={field}
                            value={row[field]}
                            className={`h-8 ${field === "name" ? "" : "font-mono"}`}
                            onChange={(event) => {
                              setRosterDirty(true);
                              setResponders((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: event.target.value } : item)));
                            }}
                          />
                        ) : (
                          <span className={field === "name" ? "" : "font-mono text-xs"}>{row[field]}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      {canEdit ? (
                        <Select
                          value={row.role}
                          onValueChange={(value) => {
                            setRosterDirty(true);
                            setResponders((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, role: value } : item)));
                          }}
                        >
                          <SelectTrigger className="h-8" aria-label="Responder role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESPONDER_ROLES.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        row.role
                      )}
                    </td>
                    {canEdit ? (
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          aria-label="Remove responder"
                          className="text-fog hover:text-status-crimson"
                          onClick={() => {
                            setRosterDirty(true);
                            setResponders((rows) => rows.filter((_, itemIndex) => itemIndex !== index));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog">{rosterDirty ? "Unsaved roster" : "Roster saved"}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => void saveRoster()} disabled={!rosterDirty}>
                Save roster
              </Button>
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Chronological events</h2>
            {canAddEvent ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdding(true);
                  setEditingId(null);
                  setDraft({ occurredAt: toDatetimeLocal(), badge, unit: "", title: "", eventType: "Observation", findings: "" });
                }}
              >
                <Plus /> Add event
              </Button>
            ) : null}
          </div>
          <p className="mb-3 text-xs text-fog">Select an event to reveal its evidence on the chart.</p>
          {adding ? <EventForm draft={draft} setDraft={setDraft} onCancel={() => setAdding(false)} onSave={() => void saveEvent()} /> : null}
          <ol className="mt-4 space-y-0 border-l border-gold/30 pl-4">
            {record.events.length === 0 ? <li className="text-sm text-fog">No events logged.</li> : null}
            {record.events.map((event) => {
              const open = expandAllEvidence || expandedEventIds.includes(event.id);
              const active = activeEventId === event.id;
              const count = evidenceCounts[event.id] ?? 0;
              return (
              <li key={event.id} className="relative pb-5">
                <span className={cn("absolute -left-[21px] top-1.5 h-2 w-2 rounded-full", active || open ? "bg-gold-bright" : "bg-gold")} />
                {editingId === event.id ? (
                  <EventForm draft={draft} setDraft={setDraft} onCancel={() => setEditingId(null)} onSave={() => void saveEvent(event)} />
                ) : (
                  <div className={cn("rounded-md px-2 py-1.5 transition-colors", open && "bg-gold/[0.06]", active && "ring-1 ring-gold/40")}>
                    <button
                      type="button"
                      className="w-full text-left"
                      aria-pressed={open}
                      aria-label={`Reveal evidence for ${event.title}`}
                      onClick={() => onRevealEvent(event.id)}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-mono text-[11px] text-gold-bright">{formatWhen(event.occurredAt)}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">
                          {event.eventType} · {event.badge} · {event.unit}
                        </div>
                      </div>
                      <h3 className="mt-1 text-sm font-medium">{event.title}</h3>
                      {count > 0 ? (
                        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">{count} evidence</div>
                      ) : null}
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{event.findings}</p>
                    </button>
                    {canEditEvent || canDeleteEvent ? (
                      <div className="mt-2 flex gap-2">
                        {canEditEvent ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(event)}>
                            Edit
                          </Button>
                        ) : null}
                        {canDeleteEvent ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => void deleteEvent(event.id)}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
              );
            })}
          </ol>
        </section>

        <p className="text-xs text-fog">
          Opened by badge {record.createdBy}
          {record.closedBy ? ` · Closed by badge ${record.closedBy}` : ""}
        </p>
        {canDeleteCase ? (
          <Button type="button" variant="destructive" onClick={() => void deleteCase()}>
            <Trash2 /> Delete case
          </Button>
        ) : null}
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Case details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Incident type</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger aria-label="Incident type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {incidentType === "Other" ? (
              <div className="space-y-2">
                <Label htmlFor="custom-incident">Custom type</Label>
                <Input id="custom-incident" value={customType} onChange={(event) => setCustomType(event.target.value)} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="detail-location">Location</Label>
              <Input id="detail-location" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-time">Date and time</Label>
              <Input id="detail-time" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDetailsOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void saveDetails()}>Save details</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventForm({
  draft,
  setDraft,
  onCancel,
  onSave,
}: {
  draft: { occurredAt: string; badge: string; unit: string; title: string; eventType: string; findings: string };
  setDraft: (draft: { occurredAt: string; badge: string; unit: string; title: string; eventType: string; findings: string }) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-4 space-y-2 rounded-md border border-white/10 bg-ink p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Event time" type="datetime-local" value={draft.occurredAt} onChange={(event) => setDraft({ ...draft, occurredAt: event.target.value })} />
        <Select value={draft.eventType} onValueChange={(eventType) => setDraft({ ...draft, eventType })}>
          <SelectTrigger aria-label="Event type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input aria-label="Reporting badge" className="font-mono" placeholder="Badge" value={draft.badge} onChange={(event) => setDraft({ ...draft, badge: event.target.value })} />
        <Input aria-label="Unit" className="font-mono" placeholder="Unit" value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} />
      </div>
      <Input aria-label="Event title" placeholder="Event title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      <Textarea aria-label="Findings" placeholder="What was found or done" value={draft.findings} onChange={(event) => setDraft({ ...draft, findings: event.target.value })} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={onSave}>Save event</Button>
      </div>
    </div>
  );
}
