import { deleteEdge, updateEdge } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; edgeId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  return withAuth("node:link", async () => {
    const { id, edgeId } = await context.params;
    const body = (await readJson(request)) as { label?: string };
    return updateEdge(id, edgeId, String(body.label ?? ""));
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth("node:link", async () => {
    const { id, edgeId } = await context.params;
    return deleteEdge(id, edgeId);
  });
}
