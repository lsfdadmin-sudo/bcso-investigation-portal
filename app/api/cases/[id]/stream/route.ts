import { getCaseDetail } from "@/lib/data";
import { withAuth } from "@/lib/http";
import { liveStreamResponse } from "@/lib/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  return withAuth(null, async () => {
    const { id } = await context.params;
    getCaseDetail(id);
    return liveStreamResponse(id);
  });
}
