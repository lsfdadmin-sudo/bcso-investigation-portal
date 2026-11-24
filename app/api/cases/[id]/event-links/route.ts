import { createEventLink } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth("node:link", async () => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    return createEventLink(id, {
      eventId: String(body.eventId ?? ""),
      nodeId: String(body.nodeId ?? ""),
      label: typeof body.label === "string" ? body.label : null,
    });
  });
}
