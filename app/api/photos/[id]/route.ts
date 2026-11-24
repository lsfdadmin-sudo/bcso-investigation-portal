import { readFile } from "node:fs/promises";
import { deletePhoto, getPhotoFile } from "@/lib/data";
import { getDb } from "@/lib/db";
import { HttpError, withAuth } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  return withAuth(null, async () => {
    const { id } = await context.params;
    const file = getPhotoFile(id);
    const bytes = await readFile(file.path);
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename="${file.name.replaceAll('"', "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'",
      },
    });
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  return withAuth(null, async (session) => {
    const { id } = await context.params;
    if (session.role === "patrol") {
      const row = getDb()
        .prepare("SELECT n.kind AS kind FROM photos p JOIN nodes n ON n.id = p.node_id WHERE p.id = ?")
        .get(id) as { kind: string } | undefined;
      if (!row || row.kind !== "evidence") {
        throw new HttpError("Insufficient clearance for this action.", 403);
      }
    }
    return deletePhoto(id);
  });
}
