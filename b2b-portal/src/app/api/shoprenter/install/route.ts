import { NextResponse } from "next/server";
import {
  parseEmbedQuery,
  verifyShoprenterHmac,
  isEmbedDevBypassAllowed,
} from "@/lib/shoprenter/embed-hmac";
import { markShopActiveFromInstall } from "@/lib/shoprenter/embed-shop";

/**
 * Shoprenter RedirectUri after App Store install.
 * Verify HMAC → optional shop reactivate → redirect to `app_url` (SR admin iframe page).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = parseEmbedQuery(url.searchParams);

  if (!parsed) {
    if (
      isEmbedDevBypassAllowed() &&
      url.searchParams.get("dev") === "1" &&
      url.searchParams.get("app_url")
    ) {
      return NextResponse.redirect(String(url.searchParams.get("app_url")));
    }
    return NextResponse.json(
      { error: "Hiányzó shopname/code/timestamp/hmac" },
      { status: 400 },
    );
  }

  const verified = verifyShoprenterHmac(parsed);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  try {
    await markShopActiveFromInstall(parsed.shopname);
  } catch (err) {
    console.error("[shoprenter/install] reactivate", err);
  }

  const appUrl = parsed.app_url?.trim();
  if (!appUrl) {
    return NextResponse.json(
      { ok: true, message: "Install OK — hiányzik az app_url" },
      { status: 200 },
    );
  }

  // Only allow Shoprenter admin hosts for redirect target.
  try {
    const target = new URL(appUrl);
    const host = target.hostname.toLowerCase();
    const ok =
      host.endsWith(".myshoprenter.hu") ||
      host.endsWith(".shoprenter.hu") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!ok) {
      return NextResponse.json(
        { error: "Nem engedélyezett app_url" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "Érvénytelen app_url" }, { status: 400 });
  }

  return NextResponse.redirect(appUrl);
}
