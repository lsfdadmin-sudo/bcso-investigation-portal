"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Plus, Search } from "lucide-react";
import { NewCaseDialog } from "@/components/board/new-case-dialog";
import { LiveDot } from "@/components/live/live-dot";
import { useLiveStream } from "@/components/live/use-live-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/client";
import { excerpt, formatWhen } from "@/lib/format";
import type { CaseStatus, CaseSummary } from "@/lib/types";

type BoardResponse = {
  cases: CaseSummary[];
  counts: { open: number; closed: number };
  incidentTypes: string[];
};

export function CaseBoard() {
  const [status, setStatus] = useState<CaseStatus>("open");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState("all");
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const loadBoard = useCallback((signal?: AbortSignal, mode: "initial" | "live" = "initial") => {
    const params = new URLSearchParams({ status });
    if (debounced) params.set("q", debounced);
    if (type !== "all") params.set("type", type);
    if (mode === "initial") setLoading(true);
    return api<BoardResponse>(`/api/cases?${params.toString()}`, { signal })
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((caught) => {
        if (signal?.aborted) return;
        if (mode === "live") return;
        setError(caught instanceof ApiError ? caught.message : "The case board could not be loaded.");
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [status, debounced, type]);

  useEffect(() => {
    const controller = new AbortController();
    void loadBoard(controller.signal, "initial");
    return () => controller.abort();
  }, [loadBoard]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void loadBoard(undefined, "live");
    }, 160);
  }, [loadBoard]);

  const liveStatus = useLiveStream("/api/events", (event) => {
    if (event.kind === "positions") return;
    scheduleRefresh();
  });

  useEffect(() => {
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const types = useMemo(() => {
    const values = new Set([...(data?.incidentTypes ?? [])]);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const counts = data?.counts ?? { open: 0, closed: 0 };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Records division</p>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="font-display text-4xl tracking-wide">Case board</h1>
              <LiveDot status={liveStatus} />
            </div>
            <p className="mt-1 max-w-xl text-sm text-fog">
              Open investigations and cleared files for Blaine County. Times are shown in Eastern Standard Time (EST).
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New case
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={status} onValueChange={(value) => setStatus(value as CaseStatus)}>
            <TabsList>
              <TabsTrigger value="open">
                Open cases
                <span className="font-mono text-[11px] text-status-amber">{counts.open}</span>
              </TabsTrigger>
              <TabsTrigger value="closed">
                Closed cases
                <span className="font-mono text-[11px] text-status-emerald">{counts.closed}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Case, location, or type"
                aria-label="Search cases"
                className="pl-9"
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="sm:w-52" aria-label="Filter by incident type">
                <SelectValue placeholder="All incident types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All incident types</SelectItem>
                {types.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-status-crimson/30 bg-status-crimson/10 px-4 py-6 text-sm text-status-crimson">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-lg border border-white/6 bg-ink" />
            ))}
          </div>
        ) : null}

        {data && data.cases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-ink px-6 py-16 text-center">
            <p className="font-display text-2xl tracking-wide">
              {debounced || type !== "all" ? "No cases match that search." : status === "open" ? "No open cases." : "No closed cases."}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-fog">
              {status === "open"
                ? "The board is clear. Open a case when the next call comes in."
                : "Cleared files will collect here after an administrator closes them."}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {data?.cases.map((item) => (
            <Link
              key={item.id}
              href={`/cases/${item.id}`}
              className="group rounded-lg border border-white/8 bg-ink p-4 transition-colors hover:border-gold/40"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs tracking-[0.14em] text-gold-bright">{item.caseNumber}</span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <Badge variant={item.status === "open" ? "open" : "closed"}>{item.status === "open" ? "Open" : "Closed"}</Badge>
                  {item.status === "closed" && item.closure ? (
                    item.closure.anyoneCharged ? (
                      item.closure.arrestReports.map((report, index) => (
                        <span
                          key={`${report}-${index}`}
                          className="inline-flex items-center rounded border border-signal-cyan/35 bg-signal-cyan/10 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.04em] text-signal-cyan"
                        >
                          {report}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-fog">
                        No charges
                      </span>
                    )
                  ) : null}
                </div>
              </div>
              <h2 className="mt-3 font-display text-2xl tracking-wide">{item.incidentType}</h2>
              <p className="mt-2 flex items-start gap-2 text-sm text-fog">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{item.location}</span>
              </p>
              <p className="mt-1 flex items-center gap-2 font-mono text-xs text-fog">
                <Clock className="h-3.5 w-3.5" />
                {formatWhen(item.occurredAt)}
              </p>
              {item.narrative ? <p className="mt-3 text-sm leading-6 text-foreground/80">{excerpt(item.narrative, 160)}</p> : null}
              <div className="mt-4 flex gap-4 border-t border-white/6 pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-fog">
                <span>{item.eventCount} events</span>
                <span className="text-status-crimson/90">{item.suspectCount} suspects</span>
                <span className="text-signal-cyan/90">{item.evidenceCount} evidence</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <NewCaseDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
