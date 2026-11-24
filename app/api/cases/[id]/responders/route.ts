import { replaceResponders, type ResponderInput } from "@/lib/data";
import { readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  return withAuth("case:edit", async () => {
    const { id } = await context.params;
    const body = (await readJson(request)) as { responders?: ResponderInput[] };
    return { responders: replaceResponders(id, Array.isArray(body.responders) ? body.responders : []) };
  });
}
