import { createCase, listCases } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";
import type { CaseStatus } from "@/lib/types";
import type { ResponderInput } from "@/lib/data";

export async function GET(request: Request) {
  return withAuth(null, async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") === "closed" ? "closed" : "open";
    return listCases({
      status: status as CaseStatus,
      q: url.searchParams.get("q") ?? "",
      type: url.searchParams.get("type") ?? "",
    });
  });
}

export async function POST(request: Request) {
  return withAuth("case:create", async (session) => {
    const body = (await readJson(request)) as Record<string, unknown>;
    const responders = Array.isArray(body.responders) ? (body.responders as ResponderInput[]) : [];
    const created = createCase({
      incidentType: String(body.incidentType ?? ""),
      location: String(body.location ?? ""),
      occurredAt: String(body.occurredAt ?? ""),
      narrative: typeof body.narrative === "string" ? body.narrative : "",
      responders,
      badge: session.badge,
    });
    if (!created) throw new HttpError("The case could not be opened.", 500);
    return Response.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
