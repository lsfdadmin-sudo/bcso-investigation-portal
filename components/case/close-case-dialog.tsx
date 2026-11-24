"use client";

import { useState } from "react";
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
import { arrestReportError, normalizeArrestReport } from "@/lib/arrest-report";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { CaseDetail } from "@/lib/types";

const CUSTOM = "custom";

export type ClosureSuspect = { id: string; name: string };

type DraftRow = {
  key: string;
  suspectNodeId: string | null;
  custom: boolean;
  name: string;
  charges: string;
  arrestReport: string;
};

type RowErrors = { name?: string; charges?: string; arrestReport?: string };

function blankRow(suspects: ClosureSuspect[]): DraftRow {
  const only = suspects.length === 1 ? suspects[0] : null;
  return {
    key: crypto.randomUUID(),
    suspectNodeId: only?.id ?? null,
    custom: suspects.length === 0,
    name: only?.name ?? "",
    charges: "",
    arrestReport: "",
  };
}

function draftFrom(record: CaseDetail, suspects: ClosureSuspect[]) {
  const closure = record.closure;
  if (!closure) {
    return { anyoneCharged: true, notes: "", rows: [blankRow(suspects)] };
  }
  return {
    anyoneCharged: closure.anyoneCharged,
    notes: closure.notes,
    rows: closure.charges.length
      ? closure.charges.map((charge) => {
          const listed = Boolean(charge.suspectNodeId && suspects.some((suspect) => suspect.id === charge.suspectNodeId));
          return {
            key: charge.id || crypto.randomUUID(),
            suspectNodeId: listed ? charge.suspectNodeId : null,
            custom: !listed,
            name: charge.name,
            charges: charge.charges,
            arrestReport: charge.arrestReport,
          };
        })
      : [blankRow(suspects)],
  };
}

function rowName(row: DraftRow, suspects: ClosureSuspect[]) {
  if (row.custom || !row.suspectNodeId) return row.name.trim();
  return suspects.find((suspect) => suspect.id === row.suspectNodeId)?.name.trim() || row.name.trim();
}

export function CloseCaseDialog({
  open,
  mode,
  record,
  suspects,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "close" | "edit";
  record: CaseDetail;
  suspects: ClosureSuspect[];
  onOpenChange: (open: boolean) => void;
  onSaved: (record: CaseDetail) => void;
}) {
  const [anyoneCharged, setAnyoneCharged] = useState(true);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [syncedOpen, setSyncedOpen] = useState(false);

  if (open !== syncedOpen) {
    setSyncedOpen(open);
    if (open) {
      const next = draftFrom(record, suspects);
      setAnyoneCharged(next.anyoneCharged);
      setNotes(next.notes);
      setRows(next.rows);
      setRowErrors({});
      setFormError("");
      setPending(false);
    }
  }

  function updateRow(key: string, patch: Partial<DraftRow>, clearError = false) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if (!clearError) return;
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit() {
    const normalized = rows.map((row) => ({ ...row, arrestReport: normalizeArrestReport(row.arrestReport) }));
    setRows(normalized);
    const nextErrors: Record<string, RowErrors> = {};
    if (anyoneCharged) {
      if (normalized.length === 0) {
        setFormError("Add at least one charged individual.");
        return;
      }
      for (const row of normalized) {
        const errors: RowErrors = {};
        if (!rowName(row, suspects)) errors.name = "Enter who was charged.";
        if (!row.charges.trim()) errors.charges = "Enter the charges filed.";
        const reportError = arrestReportError(row.arrestReport);
        if (reportError) errors.arrestReport = reportError;
        if (errors.name || errors.charges || errors.arrestReport) nextErrors[row.key] = errors;
      }
    }
    setRowErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError("");
      return;
    }
    setFormError("");
    setPending(true);
    try {
      const updated = await api<CaseDetail>(`/api/cases/${record.id}/closure`, {
        method: "PUT",
        body: JSON.stringify({
          anyoneCharged,
          notes: notes.trim(),
          charges: anyoneCharged
            ? normalized.map((row) => ({
                suspectNodeId: row.custom ? null : row.suspectNodeId,
                name: rowName(row, suspects),
                charges: row.charges.trim(),
                arrestReport: row.arrestReport,
              }))
            : [],
        }),
      });
      onSaved(updated);
      toast.success(mode === "edit" ? "Closure updated." : "Case closed.");
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "The closure was not saved.";
      setFormError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  const editing = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <DialogContent className="max-w-2xl border-gold/25 bg-[#0c1118]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        <DialogHeader>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Backdraft CAD disposition</p>
          <DialogTitle>{editing ? "Edit closure" : "Close case"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the charges or Backdraft CAD arrest report numbers. The original closed time stays on the file."
              : "The file locks when you close it. Log who was charged and the Backdraft CAD arrest report so a supervisor can verify the arrest."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-medium uppercase tracking-[0.16em] text-fog">Was anyone charged?</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={anyoneCharged}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors",
                  anyoneCharged
                    ? "border-status-crimson/50 bg-status-crimson/15 text-foreground"
                    : "border-white/10 text-fog hover:border-white/20",
                )}
                onClick={() => {
                  setAnyoneCharged(true);
                  setRows((current) => (current.length ? current : [blankRow(suspects)]));
                }}
              >
                <span className="block text-[10px] uppercase tracking-[0.16em]">Yes</span>
                <span className="mt-0.5 block text-sm">Charges filed</span>
              </button>
              <button
                type="button"
                aria-pressed={!anyoneCharged}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left transition-colors",
                  !anyoneCharged
                    ? "border-status-emerald/50 bg-status-emerald/15 text-foreground"
                    : "border-white/10 text-fog hover:border-white/20",
                )}
                onClick={() => setAnyoneCharged(false)}
              >
                <span className="block text-[10px] uppercase tracking-[0.16em]">No</span>
                <span className="mt-0.5 block text-sm">No one charged</span>
              </button>
            </div>
          </fieldset>

          {anyoneCharged ? (
            <div className="space-y-3">
              {rows.map((row, index) => {
                const errors = rowErrors[row.key];
                const showName = row.custom || suspects.length === 0;
                return (
                  <div key={row.key} className="space-y-3 rounded-md border border-white/10 bg-black/25 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                        Charged individual {index + 1}
                      </span>
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          className="text-fog hover:text-status-crimson"
                          aria-label={`Remove charged individual ${index + 1}`}
                          onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`charged-who-${row.key}`}>Who was charged</Label>
                      {suspects.length > 0 ? (
                        <Select
                          value={row.custom ? CUSTOM : row.suspectNodeId ?? undefined}
                          onValueChange={(value) => {
                            if (value === CUSTOM) {
                              updateRow(row.key, { custom: true, suspectNodeId: null, name: "" }, true);
                              return;
                            }
                            const suspect = suspects.find((item) => item.id === value);
                            updateRow(row.key, { custom: false, suspectNodeId: value, name: suspect?.name ?? "" }, true);
                          }}
                        >
                          <SelectTrigger id={`charged-who-${row.key}`} aria-label="Who was charged">
                            <SelectValue placeholder="Select a suspect" />
                          </SelectTrigger>
                          <SelectContent>
                            {suspects.map((suspect) => (
                              <SelectItem key={suspect.id} value={suspect.id}>
                                {suspect.name}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM}>Type a name</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                      {showName ? (
                        <Input
                          id={suspects.length === 0 ? `charged-who-${row.key}` : undefined}
                          aria-label={suspects.length ? "Custom name" : "Who was charged"}
                          value={row.name}
                          placeholder="Full name"
                          maxLength={80}
                          onChange={(event) => updateRow(row.key, { name: event.target.value, custom: true }, true)}
                        />
                      ) : null}
                      {errors?.name ? <p className="text-xs text-status-crimson">{errors.name}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`charged-charges-${row.key}`}>Charges</Label>
                      <Textarea
                        id={`charged-charges-${row.key}`}
                        aria-label="Charges"
                        value={row.charges}
                        placeholder="Specific charges filed"
                        className="min-h-20"
                        maxLength={2000}
                        onChange={(event) => updateRow(row.key, { charges: event.target.value }, true)}
                      />
                      {errors?.charges ? <p className="text-xs text-status-crimson">{errors.charges}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`charged-report-${row.key}`}>Backdraft CAD arrest report #</Label>
                      <Input
                        id={`charged-report-${row.key}`}
                        aria-label="Backdraft CAD arrest report number"
                        aria-invalid={errors?.arrestReport ? true : undefined}
                        value={row.arrestReport}
                        placeholder="RPT-261124-21751"
                        spellCheck={false}
                        autoComplete="off"
                        maxLength={40}
                        className="font-mono tracking-[0.08em]"
                        onChange={(event) => updateRow(row.key, { arrestReport: event.target.value.toUpperCase() }, true)}
                        onBlur={(event) => updateRow(row.key, { arrestReport: normalizeArrestReport(event.target.value) })}
                      />
                      <p className="text-[11px] text-fog">Must start with RPT-. Example RPT-261124-21751.</p>
                      {errors?.arrestReport ? (
                        <p className="text-xs text-status-crimson" role="alert">
                          {errors.arrestReport}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      suspectNodeId: null,
                      custom: suspects.length === 0,
                      name: "",
                      charges: "",
                      arrestReport: "",
                    },
                  ])
                }
              >
                <Plus />
                Add charged individual
              </Button>
            </div>
          ) : (
            <p className="text-sm leading-6 text-fog">
              Use the notes for why the file is closing — unfounded, insufficient evidence, or referred.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="closure-notes">Closure notes</Label>
            <Textarea
              id="closure-notes"
              aria-label="Closure notes"
              value={notes}
              placeholder="Optional. Unfounded, insufficient evidence, referred…"
              className="min-h-20"
              maxLength={4000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {formError ? (
            <p className="rounded-md border border-status-crimson/30 bg-status-crimson/10 px-3 py-2 text-sm text-status-crimson" role="alert">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              {editing ? "Cancel" : "Keep open"}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save closure" : "Close case"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
