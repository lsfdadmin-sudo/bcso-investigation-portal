import { createHash } from "node:crypto";
import { getDb } from "./db";
import type { Role, Session } from "./types";

export const SESSION_COOKIE = "bcso_session";
const SESSION_MS = 12 * 60 * 60 * 1000;

const ROLES = new Set<Role>(["patrol", "detective", "admin"]);

type SessionRow = {
  id: string;
  badge: string;
  role: string;
  expires_at: string;
};

export function cookieOptions(maxAge = SESSION_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.BCSO_COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve a raw session cookie against SQLite.
 * Cookie presence is not authentication: after a restart the database is empty
 * and any previously issued token is unknown.
 */
export function readSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const database = getDb();
  const row = database
    .prepare("SELECT id, badge, role, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as SessionRow | undefined;
  if (!row || row.expires_at <= new Date().toISOString()) {
    if (row) database.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }
  if (!ROLES.has(row.role as Role)) return null;
  return { badge: row.badge, role: row.role as Role };
}
