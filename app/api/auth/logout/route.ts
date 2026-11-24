import { cookies } from "next/headers";
import { cookieOptions, revokeSession, SESSION_COOKIE } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  const jar = await cookies();
  revokeSession(jar.get(SESSION_COOKIE)?.value);
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
