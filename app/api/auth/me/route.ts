import { getSession } from "@/lib/auth";
import { json } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  return json(session);
}
