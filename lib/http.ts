import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { bindLiveClient } from "./live";
import { can, type Action } from "./permissions";
import type { Session } from "./types";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError("Request body must be JSON.", 400);
  }
}

export async function withAuth(
  action: Action | null,
  handler: (session: Session) => Promise<unknown> | unknown,
) {
  let clientId: string | null = null;
  try {
    clientId = (await headers()).get("x-bcso-client");
  } catch {
    clientId = null;
  }
  return bindLiveClient(clientId, async () => {
    try {
      const session = await getSession();
      if (!session) return json({ error: "Unauthorized" }, 401);
      if (action && !can(session.role, action)) {
        return json({ error: "Insufficient clearance for this action." }, 403);
      }
      const result = await handler(session);
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: "The portal could not complete that request." }, 500);
    }
  });
}
