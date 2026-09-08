import {
  isEmbedDevBypassAllowed,
  parseEmbedQuery,
  verifyShoprenterHmac,
  type ShoprenterEmbedQuery,
} from "@/lib/shoprenter/embed-hmac";
import { setEmbedSessionCookie } from "@/lib/shoprenter/embed-session";
import { findEmbedShopByName } from "@/lib/shoprenter/embed-shop";

export type EstablishEmbedResult =
  | { ok: true; shopName: string; publicId: string }
  | {
      ok: false;
      error: string;
      code:
        | "missing_params"
        | "hmac"
        | "shop_not_found"
        | "uninstalled"
        | "session";
      shopName?: string;
    };

export async function establishEmbedSessionFromQuery(
  raw: Record<string, string | string[] | undefined>,
): Promise<EstablishEmbedResult> {
  const parsed = parseEmbedQuery(raw);
  const isDev =
    isEmbedDevBypassAllowed() &&
    (raw.dev === "1" || (Array.isArray(raw.dev) && raw.dev[0] === "1"));

  let shopName = parsed?.shopname;
  if (!shopName && isDev) {
    const sn = raw.shopname;
    shopName = (Array.isArray(sn) ? sn[0] : sn || "")
      .trim()
      .toLowerCase();
  }

  if (!shopName) {
    return {
      ok: false,
      error: "Nyisd meg az appot a Shoprenter adminból (hiányzó paraméterek).",
      code: "missing_params",
    };
  }

  if (parsed) {
    const verified = verifyShoprenterHmac(parsed as ShoprenterEmbedQuery);
    if (!verified.ok) {
      if (!isDev) {
        return { ok: false, error: verified.error, code: "hmac", shopName };
      }
    }
  } else if (!isDev) {
    return {
      ok: false,
      error: "Nyisd meg az appot a Shoprenter adminból.",
      code: "missing_params",
      shopName,
    };
  }

  const shop = await findEmbedShopByName(shopName);
  if (!shop) {
    return {
      ok: false,
      error:
        "Ez a bolt még nincs a ProGate-ben. Regisztrálj az app.progate.hu-n, vagy kérj invite-ot.",
      code: "shop_not_found",
      shopName,
    };
  }
  if (shop.status === "uninstalled") {
    return {
      ok: false,
      error: "Az app el lett távolítva erről a boltról. Telepítsd újra az App Store-ból.",
      code: "uninstalled",
      shopName,
    };
  }

  const ok = await setEmbedSessionCookie({
    shopId: shop.shopId,
    organizationId: shop.organizationId,
    shopName: shop.shopName,
    publicId: shop.publicId,
  });
  if (!ok) {
    return {
      ok: false,
      error: "Session létrehozása sikertelen (hiányzó titkos kulcs).",
      code: "session",
      shopName,
    };
  }

  return { ok: true, shopName: shop.shopName, publicId: shop.publicId };
}
