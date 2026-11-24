import { liveStreamResponse } from "@/lib/live";
import { withAuth } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withAuth(null, async () => liveStreamResponse(null));
}
