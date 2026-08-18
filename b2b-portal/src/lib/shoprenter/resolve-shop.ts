import { decryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin } from "@/lib/db";
import {
  getShoprenterConfigFromEnv,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import {
  isOriginAllowed,
  loadAllowlistByShopId,
} from "@/lib/shop-origins";

/**
 * Resolve Shoprenter config for widget/API calls.
 * Prefer `shopId` / `publicId` (shops.public_id); fall back to env for local single-tenant.
 */

export function extractShopPublicId(
  request: Request,
  body?: Record<string, unknown> | null,
): string | null {
  const url = new URL(request.url);
  const fromQuery =
    url.searchParams.get("shopId") ||
    url.searchParams.get("shop") ||
    url.searchParams.get("publicId");
  if (fromQuery?.trim()) return fromQuery.trim();

  const header =
    request.headers.get("x-shop-id") ||
    request.headers.get("x-shop-public-id");
  if (header?.trim()) return header.trim();

  if (body) {
    const sid = body.shopId ?? body.publicId;
    if (typeof sid === "string" && sid.trim()) return sid.trim();
  }
  return null;
}

export type ShopApiContext = {
  shopId: string;
  organizationId: string;
  publicId: string;
  config: ShoprenterConfig;
};

type ShopCredRow = {
  shop_id: string;
  organization_id: string;
  public_id: string;
  shoprenter_shop_name: string;
  store_url: string | null;
  status: string;
  widget_enabled: boolean;
  auth_type: "oauth" | "basic_legacy";
  ciphertext: Buffer;
  iv: Buffer;
  key_version: number;
};

async function loadShopRowByPublicId(publicId: string): Promise<ShopCredRow | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<ShopCredRow>(
      client,
      `select
         s.id as shop_id,
         s.organization_id,
         s.public_id,
         s.shoprenter_shop_name,
         s.store_url,
         s.status,
         s.widget_enabled,
         c.auth_type,
         c.ciphertext,
         c.iv,
         c.key_version
       from shops s
       join shop_credentials c on c.shop_id = s.id
       where s.public_id = $1
       limit 1`,
      [publicId],
    );
    return res.rows[0] ?? null;
  });
}

async function loadShopRowByShopName(shopName: string): Promise<ShopCredRow | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<ShopCredRow>(
      client,
      `select
         s.id as shop_id,
         s.organization_id,
         s.public_id,
         s.shoprenter_shop_name,
         s.store_url,
         s.status,
         s.widget_enabled,
         c.auth_type,
         c.ciphertext,
         c.iv,
         c.key_version
       from shops s
       join shop_credentials c on c.shop_id = s.id
       where s.shoprenter_shop_name = $1
       limit 1`,
      [shopName],
    );
    return res.rows[0] ?? null;
  });
}

async function shopContextFromRow(
  row: ShopCredRow,
  request: Request,
): Promise<ShopApiContext> {
  if (!row.widget_enabled) {
    throw new Error("Widget ki van kapcsolva ennél a shopnál");
  }
  if (row.status === "suspended" || row.status === "uninstalled") {
    throw new Error("Shop nincs aktív állapotban");
  }

  const allow = await loadAllowlistByShopId(row.shop_id);
  const origin = request.headers.get("origin");
  if (origin && !isOriginAllowed(origin, allow)) {
    throw new Error(`Origin nem engedélyezett: ${origin}`);
  }

  const plain = decryptCredentials({
    ciphertext: Buffer.from(row.ciphertext),
    iv: Buffer.from(row.iv),
    key_version: row.key_version,
  });

  const config =
    plain.auth_type === "oauth"
      ? configFromCredentials(row.shoprenter_shop_name, {
          auth_type: "oauth",
          client_id: plain.client_id,
          client_secret: plain.client_secret,
        })
      : configFromCredentials(row.shoprenter_shop_name, {
          auth_type: "basic_legacy",
          username: plain.username,
          password: plain.password,
        });

  return {
    shopId: row.shop_id,
    organizationId: row.organization_id,
    publicId: row.public_id,
    config: {
      ...config,
      storeUrl: row.store_url ?? undefined,
    },
  };
}

async function loadConfigByPublicId(
  publicId: string,
  request: Request,
): Promise<ShoprenterConfig> {
  const row = await loadShopRowByPublicId(publicId);
  if (!row) {
    throw new Error("Ismeretlen shopId (public_id)");
  }
  const ctx = await shopContextFromRow(row, request);
  return ctx.config;
}

export async function resolveShopContextForRequest(
  request: Request,
  opts?: { body?: Record<string, unknown> | null },
): Promise<ShopApiContext> {
  const publicId = extractShopPublicId(request, opts?.body ?? null);
  const row = publicId
    ? await loadShopRowByPublicId(publicId)
    : await loadShopRowByShopName(getShoprenterConfigFromEnv().shopName);
  if (!row) {
    throw new Error(
      publicId
        ? "Ismeretlen shopId (public_id)"
        : "Shop nincs a portál DB-ben — attribúció nem menthető",
    );
  }
  return shopContextFromRow(row, request);
}

export async function getShoprenterConfigForRequest(
  request: Request,
  opts?: { body?: Record<string, unknown> | null },
): Promise<ShoprenterConfig> {
  const publicId = extractShopPublicId(request, opts?.body ?? null);
  if (publicId) {
    return loadConfigByPublicId(publicId, request);
  }
  return getShoprenterConfigFromEnv();
}
