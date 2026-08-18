import { query, withPlatformAdmin } from "@/lib/db";
import { originFromStoreUrl } from "@/lib/orgs/slug";

export type ShopAllowlist = {
  shopId: string;
  publicId: string;
  storeUrl: string | null;
  origins: string[];
};

const cache = new Map<string, { at: number; value: ShopAllowlist | null }>();
const TTL_MS = 15_000;

function normalizeOrigin(raw: string): string {
  return raw.replace(/\/$/, "");
}

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isShoprenterPreviewOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith(".shoprenter.hu");
  } catch {
    return false;
  }
}

/** Storefront origin may call the widget API. */
export function isOriginAllowed(
  origin: string | null,
  allow: ShopAllowlist | null,
): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);

  if (process.env.NODE_ENV !== "production" && isLocalhostOrigin(normalized)) {
    return true;
  }

  if (isShoprenterPreviewOrigin(normalized)) return true;

  if (!allow) return false;

  const listed = allow.origins.map(normalizeOrigin).filter(Boolean);
  if (allow.storeUrl) {
    try {
      listed.push(originFromStoreUrl(allow.storeUrl));
    } catch {
      /* ignore */
    }
  }

  return listed.some((allowed) => originsEqual(allowed, normalized));
}

function originsEqual(allowed: string, incoming: string): boolean {
  if (!allowed || allowed === "*") return false;
  if (allowed === incoming) return true;
  try {
    return new URL(allowed).origin === new URL(incoming).origin;
  } catch {
    return false;
  }
}

async function loadAllowlistByPublicIdUncached(
  publicId: string,
): Promise<ShopAllowlist | null> {
  return withPlatformAdmin(async (client) => {
    const shop = await query<{
      id: string;
      public_id: string;
      store_url: string | null;
    }>(
      client,
      `select id, public_id, store_url from shops where public_id = $1 limit 1`,
      [publicId],
    );
    const row = shop.rows[0];
    if (!row) return null;
    const orig = await query<{ origin: string }>(
      client,
      `select origin from shop_allowed_origins where shop_id = $1`,
      [row.id],
    );
    return {
      shopId: row.id,
      publicId: row.public_id,
      storeUrl: row.store_url,
      origins: orig.rows.map((r) => r.origin),
    };
  });
}

export async function loadAllowlistByPublicId(
  publicId: string,
): Promise<ShopAllowlist | null> {
  const key = publicId.trim();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await loadAllowlistByPublicIdUncached(key);
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function loadAllowlistByShopId(
  shopId: string,
): Promise<ShopAllowlist | null> {
  return withPlatformAdmin(async (client) => {
    const shop = await query<{
      id: string;
      public_id: string;
      store_url: string | null;
    }>(
      client,
      `select id, public_id, store_url from shops where id = $1 limit 1`,
      [shopId],
    );
    const row = shop.rows[0];
    if (!row) return null;
    const orig = await query<{ origin: string }>(
      client,
      `select origin from shop_allowed_origins where shop_id = $1`,
      [row.id],
    );
    return {
      shopId: row.id,
      publicId: row.public_id,
      storeUrl: row.store_url,
      origins: orig.rows.map((r) => r.origin),
    };
  });
}
