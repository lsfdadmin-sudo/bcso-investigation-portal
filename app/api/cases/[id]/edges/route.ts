import { createEdge } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth("node:link", async () => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    const edge = createEdge(id, {
      sourceId: String(body.sourceId ?? ""),
      targetId: String(body.targetId ?? ""),
      label: typeof body.label === "string" ? body.label : "Associated With",
      sourceHandle: typeof body.sourceHandle === "string" ? body.sourceHandle : null,
      targetHandle: typeof body.targetHandle === "string" ? body.targetHandle : null,
    });
    return Response.json(edge, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
