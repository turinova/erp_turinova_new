import type { PoolClient } from "pg";
import {
  decryptCredentials,
  encryptCredentials,
  type EncryptedBlob,
} from "@/lib/crypto/credentials";
import { query } from "@/lib/db";
import {
  configFromCredentials,
  pingAuth,
} from "@/lib/shoprenter/ping";
import {
  normalizeStoreUrl,
  originFromStoreUrl,
} from "@/lib/orgs/slug";
import type { ShopCredentialsPlain, ShopStatus } from "@/types/db";

export type MerchantShopDto = {
  shopId: string;
  organizationId: string;
  shoprenterShopName: string;
  storeUrl: string | null;
  publicId: string;
  status: ShopStatus;
  widgetEnabled: boolean;
  lastPingAt: string | null;
  lastPingOk: boolean | null;
  lastPingError: string | null;
  hasCredentials: boolean;
  authType: "oauth" | "basic_legacy" | null;
  buttonLabel: string;
  customerGroupIds: number[];
  origins: string[];
};

type ShopRow = {
  id: string;
  organization_id: string;
  shoprenter_shop_name: string;
  store_url: string | null;
  public_id: string;
  status: ShopStatus;
  widget_enabled: boolean;
  last_ping_at: string | null;
  last_ping_ok: boolean | null;
  last_ping_error: string | null;
  catalog_status?: string;
};

export async function loadMerchantShop(
  client: PoolClient,
  orgId: string,
): Promise<MerchantShopDto | null> {
  const shopRes = await query<ShopRow>(
    client,
    `select * from shops where organization_id = $1 order by created_at limit 1`,
    [orgId],
  );
  const shop = shopRes.rows[0];
  if (!shop) return null;

  const credRes = await query<{ auth_type: "oauth" | "basic_legacy" }>(
    client,
    `select auth_type from shop_credentials where shop_id = $1`,
    [shop.id],
  );
  const widgetRes = await query<{
    button_label: string;
    customer_group_ids: number[] | null;
  }>(
    client,
    `select button_label, customer_group_ids from widget_settings where shop_id = $1`,
    [shop.id],
  );
  const originRes = await query<{ origin: string }>(
    client,
    `select origin from shop_allowed_origins where shop_id = $1 order by created_at`,
    [shop.id],
  );

  const widget = widgetRes.rows[0];

  return {
    shopId: shop.id,
    organizationId: shop.organization_id,
    shoprenterShopName: shop.shoprenter_shop_name,
    storeUrl: shop.store_url,
    publicId: shop.public_id,
    status: shop.status,
    widgetEnabled: shop.widget_enabled,
    lastPingAt: shop.last_ping_at,
    lastPingOk: shop.last_ping_ok,
    lastPingError: shop.last_ping_error,
    hasCredentials: (credRes.rowCount ?? 0) > 0,
    authType: credRes.rows[0]?.auth_type ?? null,
    buttonLabel: widget?.button_label ?? "Gyors rendelés",
    customerGroupIds: [],
    origins: originRes.rows.map((r) => r.origin),
  };
}

async function loadPlainCredentials(
  client: PoolClient,
  shopId: string,
): Promise<ShopCredentialsPlain | null> {
  const res = await query<{
    auth_type: "oauth" | "basic_legacy";
    ciphertext: Buffer;
    iv: Buffer;
    key_version: number;
  }>(
    client,
    `select auth_type, ciphertext, iv, key_version from shop_credentials where shop_id = $1`,
    [shopId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const blob: EncryptedBlob = {
    ciphertext: Buffer.from(row.ciphertext),
    iv: Buffer.from(row.iv),
    key_version: row.key_version,
  };
  return decryptCredentials(blob);
}

export type UpdateShopInput = {
  storeUrl?: string | null;
  authType?: "oauth" | "basic_legacy";
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  buttonLabel?: string;
  customerGroupIds?: number[];
  widgetEnabled?: boolean;
  origins?: string[];
};

export async function updateMerchantShop(
  client: PoolClient,
  orgId: string,
  userId: string,
  input: UpdateShopInput,
): Promise<MerchantShopDto> {
  const shopRes = await query<ShopRow>(
    client,
    `select * from shops where organization_id = $1 order by created_at limit 1`,
    [orgId],
  );
  const shop = shopRes.rows[0];
  if (!shop) throw new Error("NO_SHOP");

  const storeUrl =
    input.storeUrl === undefined
      ? shop.store_url
      : normalizeStoreUrl(input.storeUrl);

  if (input.storeUrl !== undefined && input.storeUrl?.trim() && !storeUrl) {
    throw new Error("INVALID_STORE_URL");
  }

  const widgetEnabled =
    input.widgetEnabled === undefined
      ? shop.widget_enabled
      : Boolean(input.widgetEnabled);

  await query(
    client,
    `update shops set store_url = $1, widget_enabled = $2, updated_at = now() where id = $3`,
    [storeUrl, widgetEnabled, shop.id],
  );

  const existing = await loadPlainCredentials(client, shop.id);
  const wantsCredUpdate =
    Boolean(input.username?.trim() || input.password?.trim()) || !existing;

  if (wantsCredUpdate) {
    const username =
      input.username?.trim() ||
      (existing?.auth_type === "basic_legacy" ? existing.username : "");
    const password =
      input.password?.trim() ||
      (existing?.auth_type === "basic_legacy" ? existing.password : "");
    if (!username || !password) {
      throw new Error("BASIC_INCOMPLETE");
    }
    const nextPlain: ShopCredentialsPlain = {
      auth_type: "basic_legacy",
      username,
      password,
    };

    const blob = encryptCredentials(nextPlain);
    await query(
      client,
      `insert into shop_credentials (shop_id, auth_type, ciphertext, iv, key_version, rotated_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (shop_id) do update set
         auth_type = excluded.auth_type,
         ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         key_version = excluded.key_version,
         rotated_at = now(),
         updated_at = now()`,
      [
        shop.id,
        nextPlain.auth_type,
        blob.ciphertext,
        blob.iv,
        blob.key_version,
      ],
    );
  }

  const credChanged = wantsCredUpdate;
  if (input.buttonLabel !== undefined || input.customerGroupIds !== undefined) {
    await query(
      client,
      `insert into widget_settings (shop_id, button_label, customer_group_ids)
       values ($1, $2, $3)
       on conflict (shop_id) do update set
         button_label = coalesce($2, widget_settings.button_label),
         customer_group_ids = $3,
         updated_at = now()`,
      [
        shop.id,
        input.buttonLabel?.trim() || "Gyors rendelés",
        [], // gomb mindenkinek — nincs csoport-kapu
      ],
    );
  }

  if (input.origins !== undefined || storeUrl) {
    if (input.origins !== undefined) {
      await query(client, `delete from shop_allowed_origins where shop_id = $1`, [
        shop.id,
      ]);
      for (const raw of input.origins) {
        const o = normalizeStoreUrl(raw);
        if (!o) continue;
        await query(
          client,
          `insert into shop_allowed_origins (shop_id, origin) values ($1, $2)
           on conflict do nothing`,
          [shop.id, originFromStoreUrl(o)],
        );
      }
    }
    // Merchant UI: origin always follows store URL (custom domain / bolt cím)
    if (storeUrl) {
      await query(
        client,
        `insert into shop_allowed_origins (shop_id, origin) values ($1, $2)
         on conflict do nothing`,
        [shop.id, originFromStoreUrl(storeUrl)],
      );
    }
  }

  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, 'shop.settings_updated', $3::jsonb)`,
    [
      orgId,
      userId,
      JSON.stringify({
        has_new_creds: credChanged,
        widget_enabled: widgetEnabled,
      }),
    ],
  );

  const dto = await loadMerchantShop(client, orgId);
  if (!dto) throw new Error("NO_SHOP");
  return dto;
}

export async function pingMerchantShop(
  client: PoolClient,
  orgId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string; dto: MerchantShopDto }> {
  const shopRes = await query<ShopRow>(
    client,
    `select * from shops where organization_id = $1 order by created_at limit 1`,
    [orgId],
  );
  const shop = shopRes.rows[0];
  if (!shop) throw new Error("NO_SHOP");

  const plain = await loadPlainCredentials(client, shop.id);
  if (!plain) {
    await query(
      client,
      `update shops set last_ping_at = now(), last_ping_ok = false,
         last_ping_error = $1, status = 'needs_reauth', updated_at = now()
       where id = $2`,
      ["Nincs mentett API kulcs", shop.id],
    );
    const dto = await loadMerchantShop(client, orgId);
    return { ok: false, error: "Nincs mentett API kulcs", dto: dto! };
  }

  try {
    const config = configFromCredentials(shop.shoprenter_shop_name, plain);
    const result = await pingAuth(config);
    await query(
      client,
      `update shops set last_ping_at = now(), last_ping_ok = true,
         last_ping_error = null, status = 'active', updated_at = now()
       where id = $1`,
      [shop.id],
    );
    await query(
      client,
      `insert into audit_events (organization_id, actor_user_id, action, meta)
       values ($1, $2, 'shop.ping_ok', $3::jsonb)`,
      [
        orgId,
        userId,
        JSON.stringify({ authMode: result.authMode, apiBase: result.apiBase }),
      ],
    );
    const dto = await loadMerchantShop(client, orgId);
    const { startShopBootstrap } = await import("@/lib/commerce/bootstrap");
    await startShopBootstrap(client, shop.id, orgId, config, {
      force: shop.catalog_status === "error",
    });
    return { ok: true, dto: dto! };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ping sikertelen";
    await query(
      client,
      `update shops set last_ping_at = now(), last_ping_ok = false,
         last_ping_error = $1, status = 'needs_reauth', updated_at = now()
       where id = $2`,
      [message.slice(0, 500), shop.id],
    );
    await query(
      client,
      `insert into audit_events (organization_id, actor_user_id, action, meta)
       values ($1, $2, 'shop.ping_fail', $3::jsonb)`,
      [orgId, userId, JSON.stringify({ error: message.slice(0, 200) })],
    );
    const dto = await loadMerchantShop(client, orgId);
    return { ok: false, error: message, dto: dto! };
  }
}
