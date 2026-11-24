import { createNode } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";
import { can } from "@/lib/permissions";
import type { NodeKind } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    const kind = body.kind as NodeKind;
    if (kind === "evidence" && !can(session.role, "evidence:create")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    if (kind === "suspect" && !can(session.role, "suspect:create")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    if (kind === "related" && !can(session.role, "related:create")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    const graph = createNode(id, {
      kind,
      payload: body.payload ?? {},
      linkTo: typeof body.linkTo === "string" ? body.linkTo : null,
      linkLabel: typeof body.linkLabel === "string" ? body.linkLabel : null,
    });
    return Response.json(graph, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
