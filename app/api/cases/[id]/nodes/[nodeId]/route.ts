import { deleteNode, nodeCase, updateNode } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";
import { can, type Action } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string; nodeId: string }> };

export async function PATCH(request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { id, nodeId } = await context.params;
    const located = nodeCase(nodeId);
    if (located.caseRow.id !== id) throw new HttpError("Node not found.", 404);
    const body = (await readJson(request)) as Record<string, unknown>;
    const moving = body.x !== undefined || body.y !== undefined;
    const linkingEvent = Object.prototype.hasOwnProperty.call(body, "eventId");
    if (linkingEvent && located.node.kind !== "evidence") {
      throw new HttpError("Only evidence can be tied to an event.", 400);
    }
    const editing = body.payload !== undefined || linkingEvent;
    if (moving && !can(session.role, "node:move")) {
      throw new HttpError("Insufficient clearance for this action.", 403);
    }
    if (editing) {
      const action: Action | null =
        located.node.kind === "evidence"
          ? "evidence:edit"
          : located.node.kind === "suspect"
            ? "suspect:edit"
            : located.node.kind === "related"
              ? "related:edit"
              : null;
      if (!action || !can(session.role, action)) {
        throw new HttpError("Insufficient clearance for this action.", 403);
      }
    }
    if (!moving && !editing) throw new HttpError("Nothing to update.", 400);
    return updateNode(nodeId, {
      payload: body.payload !== undefined ? body.payload : undefined,
      x: typeof body.x === "number" ? body.x : undefined,
      y: typeof body.y === "number" ? body.y : undefined,
      eventId: linkingEvent ? (typeof body.eventId === "string" && body.eventId ? body.eventId : null) : undefined,
    });
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth("node:delete", async () => {
    const { id, nodeId } = await context.params;
    const located = nodeCase(nodeId);
    if (located.caseRow.id !== id) throw new HttpError("Node not found.", 404);
    return deleteNode(nodeId);
  });
}
