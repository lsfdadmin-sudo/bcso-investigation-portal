import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookieOptions, readSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PAGES = new Set(["/"]);
const PUBLIC_API = new Set(["/api/auth/login", "/api/health"]);

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isApi = pathname.startsWith("/api/");
  // Presence of the cookie is not a session. The token has to match a row that
  // still exists. A stale cookie left over from before the process restarted
  // (Render's disk is ephemeral) must not bounce `/` to `/board`: the portal
  // layout would send that request back to `/` and the browser would loop.
  const session = readSession(token);

  if (!session) {
    if (isApi && !PUBLIC_API.has(pathname)) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return token ? clearSessionCookie(response) : response;
    }
    if (!isApi && !PUBLIC_PAGES.has(pathname)) {
      const response = NextResponse.redirect(new URL("/", request.url));
      return token ? clearSessionCookie(response) : response;
    }
    // Login page (and only the login page) drops a dead cookie on the way through
    // so the next navigation is anonymous. Public API routes set their own cookies.
    if (token && pathname === "/") return clearSessionCookie(NextResponse.next());
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.redirect(new URL("/board", request.url));
  return NextResponse.next();
}

export const runtime = "nodejs";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
