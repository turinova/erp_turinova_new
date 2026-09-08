import { NextResponse } from "next/server";
import {
  parseEmbedQuery,
  verifyShoprenterHmac,
  isEmbedDevBypassAllowed,
} from "@/lib/shoprenter/embed-hmac";
import {
  findEmbedShopByName,
  markShopUninstalled,
} from "@/lib/shoprenter/embed-shop";
import { removeWidgetScript } from "@/lib/shoprenter/install/provider";

/**
 * Shoprenter UninstallUri — HMAC verify + mark shop uninstalled / widget off.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = parseEmbedQuery(url.searchParams);

  if (!parsed) {
    if (isEmbedDevBypassAllowed() && url.searchParams.get("dev") === "1") {
      const shop = (url.searchParams.get("shopname") || "").toLowerCase();
      if (shop) {
        const row = await findEmbedShopByName(shop);
        if (row) {
          await removeWidgetScript({ shopId: row.shopId }).catch(() => {});
        }
        await markShopUninstalled(shop);
      }
      return NextResponse.json({ ok: true, dev: true });
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
    const row = await findEmbedShopByName(parsed.shopname);
    if (row) {
      await removeWidgetScript({ shopId: row.shopId }).catch((err) => {
        console.error("[shoprenter/uninstall] script cleanup", err);
      });
    }
    await markShopUninstalled(parsed.shopname);
  } catch (err) {
    console.error("[shoprenter/uninstall]", err);
    return NextResponse.json({ error: "Uninstall hiba" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
