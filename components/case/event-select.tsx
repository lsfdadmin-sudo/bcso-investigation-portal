"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CaseEvent } from "@/lib/types";

export function EventSelect({
  events,
  value,
  onChange,
  disabled,
}: {
  events: CaseEvent[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value ?? "none"} onValueChange={(next) => onChange(next === "none" ? null : next)} disabled={disabled}>
      <SelectTrigger aria-label="Linked event">
        <SelectValue placeholder="Not linked to an event" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Not linked to an event</SelectItem>
        {events.map((event) => (
          <SelectItem key={event.id} value={event.id}>
            {event.eventType} · {event.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
