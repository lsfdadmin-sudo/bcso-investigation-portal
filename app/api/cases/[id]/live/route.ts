import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { subscribeCases } from "@/lib/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { id } = await context.params;
  const row = getDb().prepare("SELECT id FROM cases WHERE id = ?").get(id);
  if (!row) {
    return Response.json({ error: "Case file not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const close = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
    unsubscribe();
    unsubscribe = () => {};
  };

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      write(`event: ready\ndata: ${JSON.stringify({ caseId: id })}\n\n`);
      unsubscribe = subscribeCases((signal) => {
        if (signal.caseId !== id) return;
        write(`event: update\ndata: ${JSON.stringify(signal)}\n\n`);
      });
      heartbeat = setInterval(() => write(`: keepalive\n\n`), 20000);
      request.signal.addEventListener("abort", () => {
        close();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
