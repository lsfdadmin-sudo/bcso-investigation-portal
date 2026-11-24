import { setRolePassword } from "@/lib/auth";
import { HttpError, readJson, withAuth } from "@/lib/http";
import { ROLE_BRIEF, ROLE_LABEL } from "@/lib/permissions";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["patrol", "detective", "admin"];

export async function GET() {
  return withAuth("settings:manage", async () => ({
    roles: ROLES.map((role) => ({
      role,
      label: ROLE_LABEL[role],
      brief: ROLE_BRIEF[role],
    })),
  }));
}

export async function PUT(request: Request) {
  return withAuth("settings:manage", async () => {
    const body = (await readJson(request)) as Record<string, unknown>;
    const updates: { role: Role; password: string }[] = [];
    const fields: { key: string; role: Role }[] = [
      { key: "patrolPassword", role: "patrol" },
      { key: "detectivePassword", role: "detective" },
      { key: "adminPassword", role: "admin" },
    ];
    for (const field of fields) {
      const value = body[field.key];
      if (value === undefined || value === "") continue;
      if (typeof value !== "string" || value.trim().length < 6 || value.trim().length > 80) {
        throw new HttpError("Each role password must be 6 to 80 characters.", 400);
      }
      updates.push({ role: field.role, password: value.trim() });
    }
    if (!updates.length) throw new HttpError("Enter a new password for at least one role.", 400);
    for (const update of updates) setRolePassword(update.role, update.password);
    return { ok: true, updated: updates.map((update) => update.role) };
  });
}
