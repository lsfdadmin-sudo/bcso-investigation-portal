import { savePositions } from "@/lib/data";
import { HttpError, readJson, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  return withAuth("node:move", async () => {
    const { id } = await context.params;
    const body = (await readJson(request)) as { positions?: { id: string; x: number; y: number }[] };
    if (!Array.isArray(body.positions) || !body.positions.length) {
      throw new HttpError("No positions to save.", 400);
    }
    return savePositions(id, body.positions);
  });
}
