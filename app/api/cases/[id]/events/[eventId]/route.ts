import { deleteEvent, updateEvent } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; eventId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  return withAuth("event:edit", async () => {
    const { id, eventId } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    return updateEvent(id, eventId, {
      occurredAt: String(body.occurredAt ?? ""),
      badge: String(body.badge ?? ""),
      unit: String(body.unit ?? ""),
      title: String(body.title ?? ""),
      eventType: String(body.eventType ?? ""),
      findings: String(body.findings ?? ""),
    });
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth("event:delete", async () => {
    const { id, eventId } = await context.params;
    return deleteEvent(id, eventId);
  });
}
