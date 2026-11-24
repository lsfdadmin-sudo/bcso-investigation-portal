"use client";

import { useState } from "react";
import { toast } from "sonner";
import { EventSelect } from "@/components/case/event-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_CATEGORIES } from "@/lib/constants";
import { ApiError, api } from "@/lib/client";
import type { CaseEvent, EvidenceCategory, GraphData } from "@/lib/types";

export function EvidenceDialog({
  open,
  caseId,
  events,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  caseId: string;
  events: CaseEvent[];
  onOpenChange: (open: boolean) => void;
  onCreated: (graph: GraphData) => void;
}) {
  const [description, setDescription] = useState("");
  const [findings, setFindings] = useState("");
  const [category, setCategory] = useState<EvidenceCategory>("other");
  const [eventId, setEventId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (!next) {
      setDescription("");
      setFindings("");
      setCategory("other");
      setEventId(null);
    }
    onOpenChange(next);
  }

  async function create() {
    if (!description.trim()) {
      toast.error("Describe the evidence before adding it.");
      return;
    }
    setPending(true);
    try {
      const graph = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          kind: "evidence",
          eventId,
          payload: { tag: "", category, description: description.trim(), findings: findings.trim(), custody: "", notes: "" },
        }),
      });
      onCreated(graph);
      close(false);
      toast.success(eventId ? "Evidence added and linked to the event." : "Evidence added to the chart.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The evidence was not added.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal-cyan">Evidence</p>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>The tag is assigned when the item is booked. Link it to a chronological event, or leave it on the open chart.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="evidence-description">Description</Label>
            <Textarea id="evidence-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was recovered" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evidence-findings">Findings</Label>
            <Textarea id="evidence-findings" value={findings} onChange={(event) => setFindings(event.target.value)} placeholder="What the item shows" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as EvidenceCategory)}>
              <SelectTrigger aria-label="Evidence category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked event</Label>
            <EventSelect events={events} value={eventId} onChange={setEventId} />
            {events.length === 0 ? <p className="text-xs text-fog">Log a chronological event to attach evidence to it.</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void create()} disabled={pending}>
            Add evidence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
