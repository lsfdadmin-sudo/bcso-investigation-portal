"use client";

import { Pencil } from "lucide-react";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { CaseDetail } from "@/lib/types";

export function CaseClosurePanel({ record, onEdit }: { record: CaseDetail; onEdit: () => void }) {
  const { role } = useSession();
  const editable = can(role, "case:edit");
  const closure = record.closure;
  const closedAt = closure?.closedAt ?? record.closedAt;
  const anyoneCharged = closure?.anyoneCharged === true;
  const disposition = !closure ? "CLOSED" : anyoneCharged ? "CHARGES FILED" : "CLOSED — NO CHARGES";

  return (
    <section className="rounded-lg border border-gold/35 bg-[#10160f] shadow-[inset_3px_0_0_0_rgba(212,175,55,0.9)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Case closure · Backdraft CAD</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                anyoneCharged
                  ? "border-status-crimson/40 bg-status-crimson/10 text-status-crimson"
                  : "border-status-emerald/40 bg-status-emerald/10 text-status-emerald"
              }`}
            >
              {disposition}
            </span>
            <span className="font-mono text-[11px] text-fog">
              {formatWhen(closedAt)}
              {closure?.closedBy ? ` · Badge ${closure.closedBy}` : ""}
            </span>
          </div>
        </div>
        {editable ? (
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            <Pencil />
            Edit closure
          </Button>
        ) : null}
      </div>
      {closure && anyoneCharged ? (
        <ul className="space-y-2 border-t border-white/8 px-4 py-3">
          {closure.charges.map((charge) => (
            <li key={charge.id} className="rounded-md border border-white/8 bg-black/25 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-fog">Charged</div>
                  <div className="mt-1 text-sm font-medium">{charge.name}</div>
                </div>
                <span className="inline-flex max-w-full items-center rounded border border-signal-cyan/40 bg-signal-cyan/10 px-2 py-1 font-mono text-[11px] tracking-[0.04em] text-signal-cyan">
                  Backdraft CAD: {charge.arrestReport}
                </span>
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-fog">Charges</div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{charge.charges}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {!closure ? (
        <p className="border-t border-white/8 px-4 py-3 text-sm text-fog">
          No Backdraft CAD disposition is on this file yet.
        </p>
      ) : null}
      {closure?.notes ? (
        <div className="border-t border-white/8 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-fog">Closure notes</div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{closure.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
