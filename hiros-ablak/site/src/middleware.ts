import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { GONE_PATH_PREFIXES } from "@/lib/redirects"

const CANONICAL_HOST = "www.hirosablak.hu"

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase()

  if (host && host !== CANONICAL_HOST && host === "hirosablak.hu") {
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    url.host = CANONICAL_HOST
    return NextResponse.redirect(url, 301)
  }

  const { pathname } = request.nextUrl
  for (const prefix of GONE_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return new NextResponse("Ez a tartalom már nem elérhető.", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|webp|svg|woff2?)$).*)",
  ],
}
