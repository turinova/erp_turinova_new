import { NextResponse } from "next/server";
import { establishEmbedSessionFromQuery } from "@/lib/shoprenter/establish-embed";
import {
  encodeEmbedSession,
  setEmbedSessionCookieOnResponse,
} from "@/lib/shoprenter/embed-session";
import { EMBED_SESSION_QUERY } from "@/lib/shoprenter/embed-token";

/**
 * Establish shop + redirect to /sr-embed?e=<signed token>.
 * Token in query is the reliable session in Shoprenter iframe (3P cookies often blocked).
 * Cookie is best-effort when the browser still accepts it.
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

  const token = encodeEmbedSession({
    shopId: result.shopId,
    organizationId: result.organizationId,
    shopName: result.shopName,
    publicId: result.publicId,
  });
  if (!token) {
    const err = new URL("/sr-embed", url.origin);
    err.searchParams.set("error", "session");
    err.searchParams.set("shopname", result.shopName);
    err.searchParams.set(
      "msg",
      "Session létrehozása sikertelen (hiányzó SR_APP_CLIENT_SECRET).",
    );
    return NextResponse.redirect(err);
  }

  const dest = new URL("/sr-embed", url.origin);
  dest.searchParams.set(EMBED_SESSION_QUERY, token);
  const res = NextResponse.redirect(dest);
  setEmbedSessionCookieOnResponse(res, token);
  return res;
}
