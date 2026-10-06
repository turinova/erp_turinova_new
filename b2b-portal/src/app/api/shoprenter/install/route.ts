import { NextResponse } from "next/server";
import {
  parseEmbedQuery,
  verifyShoprenterHmac,
  isEmbedDevBypassAllowed,
} from "@/lib/shoprenter/embed-hmac";
import {
  ensureAppStoreShop,
  kickAppStoreBootstrapAfterEnsure,
} from "@/lib/shoprenter/ensure-app-store-shop";

/**
 * Shoprenter RedirectUri after App Store install.
 * Verify HMAC → ensure org/shop/OAuth → redirect to `app_url` (SR admin iframe).
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
      const shop = (url.searchParams.get("shopname") || "").toLowerCase();
      if (shop) {
        try {
          const ensured = await ensureAppStoreShop(shop);
          kickAppStoreBootstrapAfterEnsure(ensured);
        } catch (err) {
          console.error("[shoprenter/install] ensure (dev)", err);
        }
      }
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
    const ensured = await ensureAppStoreShop(parsed.shopname);
    kickAppStoreBootstrapAfterEnsure(ensured);
  } catch (err) {
    console.error("[shoprenter/install] ensure", err);
    const msg = err instanceof Error ? err.message : "Provision hiba";
    return NextResponse.json({ error: msg }, { status: 500 });
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
