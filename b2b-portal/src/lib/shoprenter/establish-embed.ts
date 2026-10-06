import {
  isEmbedDevBypassAllowed,
  parseEmbedQuery,
  verifyShoprenterHmac,
  type ShoprenterEmbedQuery,
} from "@/lib/shoprenter/embed-hmac";
import {
  ensureAppStoreShop,
  kickAppStoreBootstrapAfterEnsure,
} from "@/lib/shoprenter/ensure-app-store-shop";

export type EstablishEmbedResult =
  | {
      ok: true;
      shopId: string;
      organizationId: string;
      shopName: string;
      publicId: string;
    }
  | {
      ok: false;
      error: string;
      code:
        | "missing_params"
        | "hmac"
        | "provision"
        | "session";
      shopName?: string;
    };

/**
 * HMAC + ensure shop. Does NOT set cookies — caller must
 * applyEmbedSessionCookie on the NextResponse (redirect).
 */
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

  let ensured;
  try {
    ensured = await ensureAppStoreShop(shopName);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Bolt létrehozása sikertelen";
    console.error("[establish-embed] ensure", shopName, err);
    return { ok: false, error: msg, code: "provision", shopName };
  }

  kickAppStoreBootstrapAfterEnsure(ensured);

  return {
    ok: true,
    shopId: ensured.shopId,
    organizationId: ensured.organizationId,
    shopName: ensured.shopName,
    publicId: ensured.publicId,
  };
}
