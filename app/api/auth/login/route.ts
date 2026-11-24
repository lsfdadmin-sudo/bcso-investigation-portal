import { authenticate, cookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { json } from "@/lib/http";

const attempts = new Map<string, { count: number; reset: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  if (current && current.reset > now && current.count >= 8) {
    return json({ error: "Too many sign-in attempts. Wait a few minutes and try again." }, 429);
  }
  if (!current || current.reset <= now) attempts.set(key, { count: 0, reset: now + 10 * 60 * 1000 });

  let body: { badge?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  try {
    const session = authenticate(String(body.badge ?? ""), String(body.password ?? ""));
    attempts.delete(key);
    const response = json({ badge: session.badge, role: session.role });
    response.cookies.set(SESSION_COOKIE, session.token, cookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign-in failed.";
    const bucket = attempts.get(key);
    if (bucket) bucket.count += 1;
    const status = message.startsWith("Enter ") ? 400 : 401;
    return json({ error: message }, status);
  }
}
