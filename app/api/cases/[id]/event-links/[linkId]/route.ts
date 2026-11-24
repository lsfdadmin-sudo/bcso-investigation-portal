import { deleteEventLink } from "@/lib/data";
import { withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; linkId: string }> };

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth("node:link", async () => {
    const { id, linkId } = await context.params;
    return deleteEventLink(id, linkId);
  });
}
