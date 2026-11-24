import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { hashToken, readSession, SESSION_COOKIE } from "./session";
import type { Role, Session } from "./types";

export { cookieOptions, readSession, SESSION_COOKIE } from "./session";

const SESSION_MS = 12 * 60 * 60 * 1000;

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = readSession(token);
  if (token && !session) {
    try {
      // Route handlers can persist this. Server Components cannot, so middleware
      // also expires the cookie on the response when the token does not resolve.
      jar.delete(SESSION_COOKIE);
    } catch {
      /* Cookie store is read-only during Server Component render. */
    }
  }
  return session;
}

export function authenticate(badge: string, password: string): Session & { token: string } {
  const normalized = badge.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,16}$/.test(normalized)) {
    throw new Error("Enter a badge number using letters, numbers, or hyphens.");
  }
  if (!password) throw new Error("Enter the role password.");

  const database = getDb();
  const roles: Role[] = ["admin", "detective", "patrol"];
  const matches = roles.filter((role) => {
    const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(`password:${role}`) as
      | { value: string }
      | undefined;
    return Boolean(row && bcrypt.compareSync(password, row.value));
  });
  if (matches.length > 1) {
    throw new Error("Role passwords overlap. An administrator must make them distinct.");
  }
  if (matches.length === 0) {
    throw new Error("Badge number or password is not recognized.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_MS);
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  database
    .prepare(
      "INSERT INTO sessions (id, token_hash, badge, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), hashToken(token), normalized, matches[0], now.toISOString(), expires.toISOString());
  return { badge: normalized, role: matches[0], token };
}

export function revokeSession(token: string | undefined) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function passwordHashes() {
  const database = getDb();
  const read = (role: Role) =>
    (database.prepare("SELECT value FROM settings WHERE key = ?").get(`password:${role}`) as { value: string })
      .value;
  return {
    patrol: read("patrol"),
    detective: read("detective"),
    admin: read("admin"),
  };
}

export function setRolePassword(role: Role, password: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(`password:${role}`, bcrypt.hashSync(password, 10));
}
