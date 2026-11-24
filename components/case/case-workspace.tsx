"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { IncidentFile } from "@/components/case/incident-file";
import { InvestigationBoard } from "@/components/case/investigation-board";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [left, setLeft] = useState(40);
  const [pane, setPane] = useState<"file" | "board">("file");
  const [confirmClose, setConfirmClose] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextRecord, nextGraph] = await Promise.all([
        api<CaseDetail>(`/api/cases/${caseId}`),
        api<GraphData>(`/api/cases/${caseId}/graph`),
      ]);
      setRecord(nextRecord);
      setGraph(nextGraph);
      setError("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The case file could not be opened.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource(`/api/cases/${caseId}/live`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.addEventListener("update", () => {
      void load();
    });
    return () => source.close();
  }, [caseId, load]);

  useEffect(() => {
    const stored = window.localStorage.getItem("bcso-split");
    const value = stored ? Number(stored) : 40;
    if (value >= 28 && value <= 68) setLeft(value);
  }, []);

  useEffect(() => {
    if (selectedEventId && record && !record.events.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [record, selectedEventId]);

  function acceptGraph(next: GraphData) {
    setGraph(next);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-white/8 lg:hidden">
        <button type="button" className={`flex-1 py-2 text-sm ${pane === "file" ? "text-gold" : "text-fog"}`} onClick={() => setPane("file")}>
          Incident file
        </button>
        <button type="button" className={`flex-1 py-2 text-sm ${pane === "board" ? "text-gold" : "text-fog"}`} onClick={() => setPane("board")}>
          Investigation board
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className={`${pane === "file" ? "flex" : "hidden"} h-full min-h-0 w-full min-w-0 flex-col lg:flex lg:w-[var(--split)] lg:max-w-[var(--split)] lg:shrink-0`}
          style={{ ["--split" as string]: `${left}%` }}
        >
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
                  <span className="font-mono text-xs">{formatWhen(record.occurredAt)} PT</span>
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] ${
                  live
                    ? "border-status-emerald/30 bg-status-emerald/10 text-status-emerald"
                    : "border-status-amber/30 bg-status-amber/10 text-status-amber"
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {live ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-emerald opacity-70" /> : null}
                  <span className={`relative h-1.5 w-1.5 rounded-full ${live ? "bg-status-emerald" : "bg-status-amber"}`} />
                </span>
                {live ? "LIVE" : "SYNC"}
              </span>
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
          <div className="min-h-0 flex-1">
            <IncidentFile
              record={record}
              onRecord={setRecord}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                setSelectedEventId(id);
                if (window.matchMedia("(max-width: 1023px)").matches) setPane("board");
              }}
            />
          </div>
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize incident file"
          onPointerDown={startResize}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-white/5 hover:bg-gold/70 lg:block"
        />
        <div className={`${pane === "board" ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-1 flex-col lg:flex`}>
          <InvestigationBoard
            caseId={record.id}
            record={record}
            graph={graph}
            locked={record.status === "closed"}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onGraph={acceptGraph}
            onRecord={setRecord}
          />
        </div>
      </div>
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this case?</DialogTitle>
            <DialogDescription>
              The file locks for every role until an administrator reopens it. Events, the narrative, and the investigation board stay on the record.
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
