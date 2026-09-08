import { NextResponse } from "next/server";
import { establishEmbedSessionFromQuery } from "@/lib/shoprenter/establish-embed";

/**
 * Sets embed session cookie then redirects to /sr-embed (Kezdőlap).
 * Used by EntryPoint when query params are present (cookie mutation must be
 * in a Route Handler, not an RSC).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    raw[k] = v;
  });

  const result = await establishEmbedSessionFromQuery(raw);
  if (!result.ok) {
    const dest = new URL("/sr-embed", url.origin);
    dest.searchParams.set("error", result.code);
    if (result.shopName) dest.searchParams.set("shopname", result.shopName);
    dest.searchParams.set("msg", result.error);
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL("/sr-embed", url.origin));
}
