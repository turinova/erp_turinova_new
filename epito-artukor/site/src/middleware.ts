import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isAuthenticated } from "@/lib/auth/mode"
import { updateSupabaseSession } from "@/lib/supabase/middleware"

const PUBLIC_PREFIXES = ["/login", "/ajanlat/", "/rfq/"]
const PUBLIC_EXACT = new Set(["/login"])

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true
  if (pathname.startsWith("/api/auth/")) return true
  if (pathname.startsWith("/api/offer/")) return true
  if (pathname.startsWith("/api/rfq/")) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  const { response, user } = await updateSupabaseSession(request)
  const authenticated = isAuthenticated(request, user?.id ?? null)
  const isPublic = isPublicPath(pathname)

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/ajanlatok", request.url))
  }

  if (!authenticated && !isPublic) {
    const loginUrl = new URL("/login", request.url)
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/" && authenticated) {
    return NextResponse.redirect(new URL("/ajanlatok", request.url))
  }

  if (pathname === "/" && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
