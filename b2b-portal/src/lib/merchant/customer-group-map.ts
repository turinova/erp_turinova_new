import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import type { ShopCredentialsPlain } from "@/types/db";

export type CustomerGroupRole = "bolt" | "gomb" | "rejtett";

export type GroupMapRow = {
  id: string;
  shop_id: string;
  sr_group_inner_id: number;
  sr_group_id: string | null;
  sr_name_snapshot: string;
  role: CustomerGroupRole;
  is_default_in_sr: boolean;
  percent_discount: number | null;
};

/** DB / SR → UI: 0 is valid; null = unknown. */
export function percentDiscountFromDb(
  v: number | string | null | undefined,
): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.trunc(n)));
}

export type GroupMapItemDto = {
  innerId: number;
  groupId: string | null;
  name: string;
  role: CustomerGroupRole;
  isDefault: boolean;
  percentDiscount: number | null;
  /** Distinct products with mirrored volume tiers (0 if none / no mirror). */
  tierProductCount?: number;
  /** SR listában nincs — portal map árva. */
  missingFromShop?: boolean;
};

async function getShopIdForOrg(
  client: PoolClient,
  orgId: string,
): Promise<{ id: string; shoprenter_shop_name: string; store_url: string | null } | null> {
  const res = await query<{
    id: string;
    shoprenter_shop_name: string;
    store_url: string | null;
  }>(
    client,
    `select id, shoprenter_shop_name, store_url
     from shops where organization_id = $1 order by created_at limit 1`,
    [orgId],
  );
  return res.rows[0] ?? null;
}

export async function loadMerchantShoprenterConfig(
  client: PoolClient,
  orgId: string,
): Promise<{ shopId: string; config: ShoprenterConfig } | null> {
  const shop = await getShopIdForOrg(client, orgId);
  if (!shop) return null;

  const credRes = await query<{
    auth_type: "oauth" | "basic_legacy";
    ciphertext: Buffer;
    iv: Buffer;
    key_version: number;
  }>(
    client,
    `select auth_type, ciphertext, iv, key_version from shop_credentials where shop_id = $1`,
    [shop.id],
  );
  const row = credRes.rows[0];
  if (!row) return null;

  const plain = decryptCredentials({
    ciphertext: Buffer.from(row.ciphertext),
    iv: Buffer.from(row.iv),
    key_version: row.key_version,
  }) as ShopCredentialsPlain;

  const config =
    plain.auth_type === "oauth"
      ? configFromCredentials(shop.shoprenter_shop_name, {
          auth_type: "oauth",
          client_id: plain.client_id,
          client_secret: plain.client_secret,
        })
      : configFromCredentials(shop.shoprenter_shop_name, {
          auth_type: "basic_legacy",
          username: plain.username,
          password: plain.password,
        });

  return {
    shopId: shop.id,
    config: { ...config, storeUrl: shop.store_url ?? undefined },
  };
}

export async function listGroupMap(
  client: PoolClient,
  shopId: string,
): Promise<GroupMapRow[]> {
  const res = await query<GroupMapRow>(
    client,
    `select id, shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot,
            role, is_default_in_sr, percent_discount
     from shop_customer_group_map
     where shop_id = $1
     order by sr_name_snapshot`,
    [shopId],
  );
  return res.rows;
}

export async function gombGroupInnerIds(
  client: PoolClient,
  shopId: string,
): Promise<number[]> {
  const res = await query<{ sr_group_inner_id: number }>(
    client,
    `select sr_group_inner_id from shop_customer_group_map
     where shop_id = $1 and role = 'gomb'`,
    [shopId],
  );
  return res.rows.map((r) => r.sr_group_inner_id);
}

/** Clear widget ACL: empty customer_group_ids = everyone sees the button. */
export async function syncWidgetAllowedGroups(
  client: PoolClient,
  shopId: string,
): Promise<number[]> {
  await query(
    client,
    `insert into widget_settings (shop_id, customer_group_ids)
     values ($1, $2)
     on conflict (shop_id) do update set
       customer_group_ids = excluded.customer_group_ids,
       updated_at = now()`,
    [shopId, []],
  );
  return [];
}

/**
 * @deprecated Group ACL removed — gomb is for everyone. Clears widget_settings only.
 */
export async function setAllowedGroupsAsGomb(
  client: PoolClient,
  shopId: string,
  _allowedInnerIds: number[],
): Promise<number[]> {
  return syncWidgetAllowedGroups(client, shopId);
}

export type SaveGroupMapInput = {
  innerId: number;
  groupId?: string | null;
  name: string;
  role: CustomerGroupRole;
  isDefault?: boolean;
};

export async function saveGroupMap(
  client: PoolClient,
  shopId: string,
  orgId: string,
  userId: string,
  items: SaveGroupMapInput[],
): Promise<number[]> {
  for (const item of items) {
    const role = item.role;
    if (role !== "bolt" && role !== "gomb" && role !== "rejtett") {
      throw new Error("INVALID_ROLE");
    }
    await query(
      client,
      `insert into shop_customer_group_map (
         shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot, role, is_default_in_sr
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (shop_id, sr_group_inner_id) do update set
         sr_group_id = coalesce(excluded.sr_group_id, shop_customer_group_map.sr_group_id),
         sr_name_snapshot = excluded.sr_name_snapshot,
         role = excluded.role,
         is_default_in_sr = excluded.is_default_in_sr,
         updated_at = now()`,
      [
        shopId,
        item.innerId,
        item.groupId ?? null,
        item.name.slice(0, 200),
        role,
        Boolean(item.isDefault),
      ],
    );
  }

  const allowed = await syncWidgetAllowedGroups(client, shopId);

  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, 'customer_groups.map_saved', $3::jsonb)`,
    [
      orgId,
      userId,
      JSON.stringify({
        shopId,
        gombIds: allowed,
        count: items.length,
      }),
    ],
  );

  return allowed;
}

/**
 * Portal-only cleanup after SR group delete / orphan.
 * Does not call Shoprenter. Leaves shop_customers / b2b_orders history intact.
 */
export async function purgePortalCustomerGroup(
  client: PoolClient,
  opts: {
    shopId: string;
    groupInnerId: number;
    groupOuterId?: string | null;
  },
): Promise<{
  mapDeleted: number;
  pricesDeleted: number;
  tiersDeleted: number;
  syncDeleted: number;
}> {
  const shopId = opts.shopId;
  const innerId = Math.round(opts.groupInnerId);
  const outer = (opts.groupOuterId ?? "").trim() || null;

  let pricesDeleted = 0;
  let tiersDeleted = 0;
  let syncDeleted = 0;

  if (outer) {
    const prices = await query<{ n: string }>(
      client,
      `with d as (
         delete from partner_group_prices
         where shop_id = $1 and customer_group_outer_id = $2
         returning 1
       )
       select count(*)::text as n from d`,
      [shopId, outer],
    );
    pricesDeleted = Number(prices.rows[0]?.n ?? 0);

    const tiers = await query<{ n: string }>(
      client,
      `with d as (
         delete from partner_volume_tiers
         where shop_id = $1 and customer_group_outer_id = $2
         returning 1
       )
       select count(*)::text as n from d`,
      [shopId, outer],
    ).catch(() => ({ rows: [{ n: "0" }] }));
    tiersDeleted = Number(tiers.rows[0]?.n ?? 0);

    const sync = await query<{ n: string }>(
      client,
      `with d as (
         delete from partner_group_price_sync
         where shop_id = $1 and customer_group_outer_id = $2
         returning 1
       )
       select count(*)::text as n from d`,
      [shopId, outer],
    ).catch(() => ({ rows: [{ n: "0" }] }));
    syncDeleted = Number(sync.rows[0]?.n ?? 0);
  }

  // Widget ACL (legacy): remove inner id from allowlist if present
  await query(
    client,
    `update widget_settings
     set customer_group_ids = array_remove(customer_group_ids, $2),
         updated_at = now()
     where shop_id = $1
       and customer_group_ids is not null
       and $2 = any(customer_group_ids)`,
    [shopId, innerId],
  ).catch(() => null);

  const map = await query<{ n: string }>(
    client,
    `with d as (
       delete from shop_customer_group_map
       where shop_id = $1 and sr_group_inner_id = $2
       returning 1
     )
     select count(*)::text as n from d`,
    [shopId, innerId],
  );

  return {
    mapDeleted: Number(map.rows[0]?.n ?? 0),
    pricesDeleted,
    tiersDeleted,
    syncDeleted,
  };
}
