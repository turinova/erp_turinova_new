import { NextResponse } from "next/server";
import { extractShopPublicId } from "@/lib/shoprenter/resolve-shop";
import {
  isOriginAllowed,
  loadAllowlistByPublicId,
} from "@/lib/shop-origins";

export function corsHeadersFor(
  allowOrigin: string | null,
  extra?: HeadersInit,
): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers":
      "Content-Disposition, X-Export-Orders, X-Export-Lines, X-Export-Errors, X-Export-Truncated",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
  }
  return { ...headers, ...(extra as Record<string, string> | undefined) };
}

export async function resolveAllowOrigin(
  request: Request,
): Promise<string | null> {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const publicId = extractShopPublicId(request);
  const allow = publicId ? await loadAllowlistByPublicId(publicId) : null;

  if (isOriginAllowed(origin, allow)) return origin.replace(/\/$/, "");
  return null;
}

export async function corsHeadersForRequest(
  request: Request,
  extra?: HeadersInit,
): Promise<HeadersInit> {
  const allowOrigin = await resolveAllowOrigin(request);
  return corsHeadersFor(allowOrigin, extra);
}

export async function jsonWithCors(
  request: Request,
  body: unknown,
  init?: { status?: number },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: await corsHeadersForRequest(request),
  });
}

export async function optionsCors(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: await corsHeadersForRequest(request),
  });
}
