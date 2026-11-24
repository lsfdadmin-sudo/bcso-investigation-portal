import { getGraph } from "@/lib/data";
import { withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  return withAuth(null, async () => {
    const { id } = await context.params;
    return getGraph(id);
  });
}
