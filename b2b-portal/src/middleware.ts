import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COMPANY } from "@/lib/company";
import { isAppHost, isMarketingHost, normalizeHost } from "@/lib/hosts";

const SESSION_COOKIE = "b2b_session";

const PROTECTED = [
  "/admin",
  "/home",
  "/settings",
  "/widget",
  "/vevok",
  "/riport",
  "/csomag",
  "/arak",
  "/automatizmus",
  "/szintlepes",
  "/tudasbazis",
];

function hostname(req: NextRequest): string {
  return normalizeHost(
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "",
  );
}

function appUrl(pathname: string, search: string): URL {
  const url = new URL(pathname, COMPANY.productUrl);
  url.search = search;
  return url;
}

export function middleware(req: NextRequest) {
  const host = hostname(req);
  const { pathname } = req.nextUrl;
  const marketing = isMarketingHost(host);
  const app = isAppHost(host);
  const session = req.cookies.get(SESSION_COOKIE)?.value;

  if (app && pathname === "/" && !session) {
    return NextResponse.redirect(`${COMPANY.marketingUrl}/`);
  }

  if (
    marketing &&
    (pathname === "/login" || pathname.startsWith("/signup"))
  ) {
    return NextResponse.redirect(appUrl(pathname, req.nextUrl.search));
  }

  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  if (!session) {
    if (marketing) {
      const url = appUrl("/login", "");
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (marketing) {
    return NextResponse.redirect(appUrl(pathname, req.nextUrl.search));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/login/:path*",
    "/signup",
    "/signup/:path*",
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
    "/arak",
    "/arak/:path*",
    "/automatizmus",
    "/automatizmus/:path*",
    "/szintlepes",
    "/szintlepes/:path*",
    "/tudasbazis",
    "/tudasbazis/:path*",
  ],
};
