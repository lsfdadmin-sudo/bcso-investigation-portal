import { saveCaseClosure } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";
import { can } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { id } = await context.params;
    const body = (await readJson(request)) as Record<string, unknown>;
    if (typeof body.anyoneCharged !== "boolean") {
      throw new HttpError("Say whether anyone was charged.", 400);
    }
    return saveCaseClosure(
      id,
      {
        anyoneCharged: body.anyoneCharged,
        notes: body.notes,
        charges: body.charges,
      },
      session.badge,
      {
        allowClose: can(session.role, "case:status"),
        allowEdit: can(session.role, "case:edit"),
      },
    );
  });
}
