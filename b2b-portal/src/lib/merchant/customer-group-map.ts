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
};

export type GroupMapItemDto = {
  innerId: number;
  groupId: string | null;
  name: string;
  role: CustomerGroupRole;
  isDefault: boolean;
  percentDiscount: number | null;
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
            role, is_default_in_sr
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
