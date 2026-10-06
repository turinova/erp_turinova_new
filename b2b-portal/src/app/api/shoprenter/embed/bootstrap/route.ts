import { NextResponse } from "next/server";
import { establishEmbedSessionFromQuery } from "@/lib/shoprenter/establish-embed";
import { applyEmbedSessionCookie } from "@/lib/shoprenter/embed-session";

/**
 * Sets embed session cookie on the redirect response, then → /sr-embed.
 * Cookie must be on NextResponse (not cookies().set alone) for Shoprenter iframe.
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

  const res = NextResponse.redirect(new URL("/sr-embed", url.origin));
  const cookieOk = applyEmbedSessionCookie(res, {
    shopId: result.shopId,
    organizationId: result.organizationId,
    shopName: result.shopName,
    publicId: result.publicId,
  });
  if (!cookieOk) {
    const dest = new URL("/sr-embed", url.origin);
    dest.searchParams.set("error", "session");
    dest.searchParams.set("shopname", result.shopName);
    dest.searchParams.set(
      "msg",
      "Session létrehozása sikertelen (hiányzó SR_APP_CLIENT_SECRET).",
    );
    return NextResponse.redirect(dest);
  }

  return res;
}
