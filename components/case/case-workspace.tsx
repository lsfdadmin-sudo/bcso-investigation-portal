"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { GraphPane } from "@/components/case/graph-pane";
import { IncidentFile } from "@/components/case/incident-file";
import { LiveDot } from "@/components/live/live-dot";
import { useLiveStream } from "@/components/live/use-live-stream";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/client";
import { formatWhen } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { CaseDetail, CaseStatus, GraphData } from "@/lib/types";

export function CaseWorkspace({ caseId }: { caseId: string }) {
  const { role } = useSession();
  const [record, setRecord] = useState<CaseDetail | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [left, setLeft] = useState(42);
  const [pane, setPane] = useState<"file" | "graph">("file");
  const [confirmClose, setConfirmClose] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<string[]>([]);
  const [expandAllEvidence, setExpandAllEvidence] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ nonce: number; eventId: string | null }>({ nonce: 0, eventId: null });
  const refreshTimer = useRef<number | null>(null);

  const load = useCallback(async (mode: "initial" | "live" = "initial") => {
    try {
      const [nextRecord, nextGraph] = await Promise.all([
        api<CaseDetail>(`/api/cases/${caseId}`),
        api<GraphData>(`/api/cases/${caseId}/graph`),
      ]);
      setRecord(nextRecord);
      setGraph(nextGraph);
      setRevision((value) => value + 1);
      setError("");
    } catch (caught) {
      const missing = caught instanceof ApiError && caught.status === 404;
      if (mode === "live" && !missing) return;
      setError(caught instanceof ApiError ? caught.message : "The case file could not be opened.");
      if (missing) {
        setRecord(null);
        setGraph(null);
      }
    } finally {
      if (mode === "initial") setLoading(false);
    }
  }, [caseId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void load("live");
    }, 160);
  }, [load]);

  const liveStatus = useLiveStream(`/api/cases/${caseId}/stream`, (event) => {
    if (event.kind === "positions") return;
    scheduleRefresh();
  });

  const evidenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of graph?.nodes ?? []) {
      if (node.kind === "evidence" && node.eventId) counts[node.eventId] = (counts[node.eventId] ?? 0) + 1;
    }
    return counts;
  }, [graph]);

  useEffect(() => {
    void load("initial");
  }, [load]);

  useEffect(() => {
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!record) return;
    const ids = new Set(record.events.map((event) => event.id));
    setExpandedEventIds((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
    setActiveEventId((current) => (current && ids.has(current) ? current : null));
  }, [record]);

  useEffect(() => {
    const stored = window.localStorage.getItem("bcso-split");
    const value = stored ? Number(stored) : 42;
    if (value >= 28 && value <= 68) setLeft(value);
  }, []);

  function acceptGraph(next: GraphData) {
    setGraph(next);
    setRevision((value) => value + 1);
  }

  async function setStatus(status: CaseStatus) {
    if (!record) return;
    try {
      const updated = await api<CaseDetail>(`/api/cases/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRecord(updated);
      setConfirmClose(false);
      toast.success(status === "closed" ? "Case closed." : "Case reopened.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Status was not changed.");
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    function move(next: PointerEvent) {
      const percent = ((next.clientX - bounds.left) / bounds.width) * 100;
      const clamped = Math.min(68, Math.max(28, percent));
      setLeft(clamped);
      window.localStorage.setItem("bcso-split", String(Math.round(clamped)));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (loading && !record) {
    return (
      <div className="grid h-full gap-px bg-white/5 lg:grid-cols-2">
        <div className="animate-pulse bg-ink" />
        <div className="animate-pulse bg-[#0b1016]" />
      </div>
    );
  }

  if (error || !record || !graph) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display text-3xl">Case file unavailable</p>
        <p className="max-w-md text-sm text-fog">{error || "That case is not on this portal."}</p>
        <Button asChild variant="secondary">
          <Link href="/board">Return to the board</Link>
        </Button>
      </div>
    );
  }

  const admin = can(role, "case:status");

  function toggleEvent(eventId: string) {
    if (!record) return;
    setActiveEventId(eventId);
    setPane("graph");
    setFocus({ nonce: Date.now(), eventId });
    if (expandAllEvidence) {
      setExpandAllEvidence(false);
      setExpandedEventIds(record.events.filter((event) => event.id !== eventId).map((event) => event.id));
      return;
    }
    setExpandedEventIds((current) => (current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]));
  }

  function setAllEvidence(open: boolean) {
    setExpandAllEvidence(open);
    if (!open) setExpandedEventIds([]);
    setFocus({ nonce: Date.now(), eventId: null });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <Link href="/board" className="inline-flex items-center gap-1 text-xs text-fog hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Case board
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm tracking-[0.14em] text-gold-bright">{record.caseNumber}</span>
            <h1 className="font-display text-2xl tracking-wide sm:text-3xl">{record.incidentType}</h1>
          </div>
          <p className="mt-1 flex items-start gap-2 text-sm text-fog">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {record.location}
              <span className="mx-2 text-white/20">·</span>
              <span className="font-mono text-xs">{formatWhen(record.occurredAt)}</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LiveDot status={liveStatus} />
          {admin ? (
            <div className="inline-flex rounded-md border border-white/10 p-0.5">
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${record.status === "open" ? "bg-status-amber/15 text-status-amber" : "text-fog"}`}
                onClick={() => {
                  if (record.status !== "open") void setStatus("open");
                }}
              >
                Open
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 text-xs ${record.status === "closed" ? "bg-status-emerald/15 text-status-emerald" : "text-fog"}`}
                onClick={() => {
                  if (record.status === "open") setConfirmClose(true);
                }}
              >
                Closed
              </button>
            </div>
          ) : (
            <Badge variant={record.status === "open" ? "open" : "closed"}>{record.status === "open" ? "Open" : "Closed"}</Badge>
          )}
        </div>
      </div>
      <div className="flex border-b border-white/8 lg:hidden">
        <button type="button" className={`flex-1 py-2 text-sm ${pane === "file" ? "text-gold" : "text-fog"}`} onClick={() => setPane("file")}>
          Incident file
        </button>
        <button type="button" className={`flex-1 py-2 text-sm ${pane === "graph" ? "text-gold" : "text-fog"}`} onClick={() => setPane("graph")}>
          Link analysis
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={`${pane === "file" ? "flex" : "hidden"} h-full min-h-0 w-full min-w-0 flex-col lg:flex lg:w-[var(--split)] lg:max-w-[var(--split)] lg:shrink-0`}
          style={{ ["--split" as string]: `${left}%` }}
        >
          <IncidentFile
            record={record}
            onRecord={setRecord}
            activeEventId={activeEventId}
            expandedEventIds={expandedEventIds}
            expandAllEvidence={expandAllEvidence}
            evidenceCounts={evidenceCounts}
            onRevealEvent={toggleEvent}
          />
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize incident file"
          onPointerDown={startResize}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-white/5 hover:bg-gold/70 lg:block"
        />
        <div className={`${pane === "graph" ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
          <GraphPane
            caseId={record.id}
            graph={graph}
            events={record.events}
            revision={revision}
            locked={record.status === "closed"}
            expandedEventIds={expandedEventIds}
            expandAllEvidence={expandAllEvidence}
            activeEventId={activeEventId}
            focusNonce={focus.nonce}
            focusEventId={focus.eventId}
            onGraph={acceptGraph}
            onToggleEvent={toggleEvent}
            onExpandAll={setAllEvidence}
          />
        </div>
      </div>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this case?</DialogTitle>
            <DialogDescription>
              The file locks for every role until an administrator reopens it. Events, the narrative, and the link chart stay on the record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmClose(false)}>
              Keep open
            </Button>
            <Button type="button" onClick={() => void setStatus("closed")}>
              Close case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
