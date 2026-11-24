import { createEvent } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth("event:create", async (session) => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    const event = createEvent(
      id,
      {
        occurredAt: String(body.occurredAt ?? ""),
        badge: String(body.badge ?? session.badge),
        unit: String(body.unit ?? ""),
        title: String(body.title ?? ""),
        eventType: String(body.eventType ?? ""),
        findings: String(body.findings ?? ""),
      },
      session.badge,
    );
    return Response.json(event, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
