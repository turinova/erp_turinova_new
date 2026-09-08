import { createHmac, timingSafeEqual } from "crypto";

/**
 * Shoprenter App Store HMAC (EntryPoint / RedirectUri / UninstallUri).
 * Message: `shopname={shop}&code={code}&timestamp={ts}`
 * @see https://doc.shoprenter.hu/development/app-development/01_getting_started.html
 */

export type ShoprenterEmbedQuery = {
  shopname: string;
  code: string;
  timestamp: string;
  hmac: string;
  app_url?: string;
};

export function getSrAppClientSecret(): string | null {
  const s =
    process.env.SR_APP_CLIENT_SECRET?.trim() ||
    process.env.SHOPRENTER_APP_CLIENT_SECRET?.trim() ||
    "";
  return s || null;
}

export function isEmbedDevBypassAllowed(): boolean {
  if (process.env.SR_EMBED_DEV === "1") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function parseEmbedQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ShoprenterEmbedQuery | null {
  const get = (key: string): string => {
    if (input instanceof URLSearchParams) {
      return (input.get(key) || "").trim();
    }
    const raw = input[key];
    if (Array.isArray(raw)) return (raw[0] || "").trim();
    return (raw || "").trim();
  };

  const shopname = get("shopname").toLowerCase();
  const code = get("code");
  const timestamp = get("timestamp");
  const hmac = get("hmac");
  const app_url = get("app_url") || undefined;

  if (!shopname || !code || !timestamp || !hmac) return null;
  return { shopname, code, timestamp, hmac, app_url };
}

export function buildHmacMessage(q: {
  shopname: string;
  code: string;
  timestamp: string;
}): string {
  return `shopname=${q.shopname}&code=${q.code}&timestamp=${q.timestamp}`;
}

export function verifyShoprenterHmac(
  q: ShoprenterEmbedQuery,
  secret = getSrAppClientSecret(),
): { ok: true } | { ok: false; error: string } {
  if (!secret) {
    return { ok: false, error: "Hiányzik a SR_APP_CLIENT_SECRET" };
  }

  const ts = Number(q.timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "Érvénytelen timestamp" };
  }
  // Reject very old timestamps (24h) to limit replay; SR may retry briefly.
  const ageSec = Math.abs(Date.now() / 1000 - ts);
  if (ageSec > 86_400) {
    return { ok: false, error: "Lejárt timestamp" };
  }

  const message = buildHmacMessage(q);
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const provided = q.hmac.toLowerCase();

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Érvénytelen HMAC" };
    }
  } catch {
    return { ok: false, error: "Érvénytelen HMAC" };
  }

  return { ok: true };
}
