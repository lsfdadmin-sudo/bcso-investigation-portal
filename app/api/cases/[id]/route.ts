import { deleteCase, getCaseDetail, updateCase } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";
import { can } from "@/lib/permissions";
import type { CaseStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  return withAuth(null, async () => {
    const { id } = await context.params;
    return getCaseDetail(id);
  });
}

export async function PATCH(request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    const patch: {
      incidentType?: string;
      location?: string;
      occurredAt?: string;
      narrative?: string;
      status?: CaseStatus;
    } = {};
    if (typeof body.incidentType === "string") patch.incidentType = body.incidentType;
    if (typeof body.location === "string") patch.location = body.location;
    if (typeof body.occurredAt === "string") patch.occurredAt = body.occurredAt;
    if (typeof body.narrative === "string") patch.narrative = body.narrative;
    if (body.status === "open" || body.status === "closed") patch.status = body.status;
    const { status, ...details } = patch;
    if (status && !can(session.role, "case:status")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    if (Object.keys(details).length && !can(session.role, "case:edit")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    if (!status && !Object.keys(details).length) throw new HttpError("Nothing to update.", 400);
    return updateCase(id, patch, session.badge);
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth("case:delete", async () => {
    const { id } = await context.params;
    return deleteCase(id);
  });
}
