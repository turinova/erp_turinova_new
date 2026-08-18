import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "b2b_session";

const PROTECTED = ["/admin", "/home", "/settings", "/widget", "/vevok", "/riport", "/csomag"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/home",
    "/settings",
    "/settings/:path*",
    "/widget",
    "/widget/:path*",
    "/vevok",
    "/vevok/:path*",
    "/riport",
    "/riport/:path*",
    "/csomag",
    "/csomag/:path*",
  ],
};
