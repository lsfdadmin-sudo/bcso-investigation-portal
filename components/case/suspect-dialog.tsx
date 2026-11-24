"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUSPECT_STATUSES } from "@/lib/constants";
import { ApiError, api } from "@/lib/client";
import type { GraphData, SuspectStatus } from "@/lib/types";

export function SuspectDialog({
  open,
  caseId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  caseId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (graph: GraphData) => void;
}) {
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [status, setStatus] = useState<SuspectStatus>("person_of_interest");
  const [pending, setPending] = useState(false);

  function close(next: boolean) {
    if (!next) {
      setName("");
      setAlias("");
      setStatus("person_of_interest");
    }
    onOpenChange(next);
  }

  async function create() {
    if (!name.trim()) {
      toast.error("Name the suspect before adding them.");
      return;
    }
    setPending(true);
    try {
      const graph = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          kind: "suspect",
          payload: { name: name.trim(), alias: alias.trim(), status, notes: "" },
        }),
      });
      onCreated(graph);
      close(false);
      toast.success("Suspect added to the chart.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The suspect was not added.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-status-crimson">Suspect</p>
          <DialogTitle>Add suspect</DialogTitle>
          <DialogDescription>Name the person and set their status. Notes and photos can be added from the inspector.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="add-suspect-name">Name</Label>
            <Input id="add-suspect-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-suspect-alias">Alias</Label>
            <Input id="add-suspect-alias" value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as SuspectStatus)}>
              <SelectTrigger aria-label="Suspect status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUSPECT_STATUSES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void create()} disabled={pending}>
            Add suspect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
