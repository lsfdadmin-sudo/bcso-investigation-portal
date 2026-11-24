import { addPhotos, nodeCase } from "@/lib/data";
import { HttpError, withAuth } from "@/lib/http";
import { can } from "@/lib/permissions";

type Ctx = { params: Promise<{ nodeId: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { nodeId } = await context.params;
    const located = nodeCase(nodeId);
    const allowed =
      located.node.kind === "evidence"
        ? can(session.role, "evidence:edit")
        : located.node.kind === "suspect"
          ? can(session.role, "suspect:edit")
          : located.node.kind === "related"
            ? can(session.role, "related:edit")
            : can(session.role, "case:edit");
    if (!allowed) throw new HttpError("Insufficient clearance for this action.", 403);
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    const photos = await addPhotos(nodeId, files);
    return Response.json(photos, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
