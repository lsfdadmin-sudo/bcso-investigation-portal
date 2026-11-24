"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { INCIDENT_TYPES, RESPONDER_ROLES } from "@/lib/constants";
import { ApiError, api } from "@/lib/client";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/format";
import type { CaseDetail } from "@/lib/types";

type DraftResponder = { badge: string; name: string; role: string };

const emptyResponder = (): DraftResponder => ({ badge: "", name: "", role: "Primary" });

export function NewCaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [incidentType, setIncidentType] = useState<string>(INCIDENT_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [location, setLocation] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDatetimeLocal());
  const [narrative, setNarrative] = useState("");
  const [responders, setResponders] = useState<DraftResponder[]>([emptyResponder()]);
  const [pending, setPending] = useState(false);

  function reset() {
    setIncidentType(INCIDENT_TYPES[0]);
    setCustomType("");
    setLocation("");
    setOccurredAt(toDatetimeLocal());
    setNarrative("");
    setResponders([emptyResponder()]);
  }

  async function create() {
    const type = incidentType === "Other" ? customType.trim() : incidentType;
    if (!type || !location.trim() || !occurredAt) {
      toast.error("Incident type, location, and date are required.");
      return;
    }
    const filled = responders.filter((row) => row.badge || row.name);
    if (filled.some((row) => !row.badge || !row.name || !row.role)) {
      toast.error("Complete every responder row, or clear it.");
      return;
    }
    setPending(true);
    try {
      const created = await api<CaseDetail>("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          incidentType: type,
          location,
          occurredAt: fromDatetimeLocal(occurredAt),
          narrative,
          responders: filled,
        }),
      });
      toast.success(`${created.caseNumber} opened.`);
      onOpenChange(false);
      reset();
      router.push(`/cases/${created.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The case was not opened.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open a case</DialogTitle>
          <DialogDescription>
            Start the incident file. A case number is assigned when the file is created, and the incident opens on the investigation board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Incident type</Label>
            <Select value={incidentType} onValueChange={setIncidentType}>
              <SelectTrigger aria-label="Incident type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {incidentType === "Other" ? (
            <div className="space-y-2">
              <Label htmlFor="custom-type">Custom type</Label>
              <Input id="custom-type" value={customType} onChange={(event) => setCustomType(event.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="occurred">Date and time (EST)</Label>
              <Input id="occurred" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </div>
          )}
          {incidentType === "Other" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="occurred-2">Date and time (EST)</Label>
              <Input id="occurred-2" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Street, cross street, community"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="narrative">Initial narrative</Label>
            <Textarea
              id="narrative"
              value={narrative}
              onChange={(event) => setNarrative(event.target.value)}
              placeholder="What was reported, who was on scene, and what is known so far."
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Initial response</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setResponders((rows) => [...rows, emptyResponder()])}>
              <Plus />
              Add unit
            </Button>
          </div>
          <div className="space-y-2">
            {responders.map((row, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
                <Input
                  aria-label="Responder badge"
                  placeholder="Badge"
                  value={row.badge}
                  className="font-mono"
                  onChange={(event) =>
                    setResponders((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, badge: event.target.value } : item)))
                  }
                />
                <Input
                  aria-label="Responder name"
                  placeholder="Name"
                  value={row.name}
                  onChange={(event) =>
                    setResponders((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))
                  }
                />
                <Select
                  value={row.role}
                  onValueChange={(role) =>
                    setResponders((rows) => rows.map((item, itemIndex) => (itemIndex === index ? { ...item, role } : item)))
                  }
                >
                  <SelectTrigger aria-label="Responder role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONDER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove responder"
                  onClick={() => setResponders((rows) => (rows.length === 1 ? [emptyResponder()] : rows.filter((_, itemIndex) => itemIndex !== index)))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={create} disabled={pending}>
            {pending ? "Opening" : "Open case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
