import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import {
  kickBootstrapWorkers,
  startShopBootstrap,
} from "@/lib/commerce/bootstrap";
import { encryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin } from "@/lib/db";
import {
  ensureSlug,
  normalizeStoreUrl,
  originFromStoreUrl,
} from "@/lib/orgs/slug";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  getSrAppClientId,
  getSrAppClientSecret,
} from "@/lib/shoprenter/embed-hmac";
import type { PoolClient } from "pg";

export type EnsureAppStoreShopResult = {
  shopId: string;
  organizationId: string;
  shopName: string;
  publicId: string;
  storeUrl: string;
  created: boolean;
  reactivated: boolean;
};

function defaultStoreUrl(shopName: string): string {
  return `https://${shopName}.myshoprenter.hu`;
}

async function upsertAppOAuthCredentials(
  client: PoolClient,
  shopId: string,
): Promise<void> {
  const clientId = getSrAppClientId();
  const clientSecret = getSrAppClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Hiányzik a SR_APP_CLIENT_ID vagy SR_APP_CLIENT_SECRET (App Store OAuth)",
    );
  }
  const blob = encryptCredentials({
    auth_type: "oauth",
    client_id: clientId,
    client_secret: clientSecret,
  });
  await query(
    client,
    `insert into shop_credentials (shop_id, auth_type, ciphertext, iv, key_version, rotated_at)
     values ($1, 'oauth', $2, $3, $4, now())
     on conflict (shop_id) do update set
       auth_type = 'oauth',
       ciphertext = excluded.ciphertext,
       iv = excluded.iv,
       key_version = excluded.key_version,
       rotated_at = now(),
       updated_at = now()`,
    [shopId, blob.ciphertext, blob.iv, blob.key_version],
  );
}

/**
 * Idempotent App Store provision: org + shop + OAuth creds + store URL.
 * Called from RedirectUri install and EntryPoint bootstrap.
 */
export async function ensureAppStoreShop(
  shopNameRaw: string,
): Promise<EnsureAppStoreShopResult> {
  const shopName = shopNameRaw.trim().toLowerCase();
  if (!shopName || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(shopName)) {
    throw new Error("Érvénytelen Shoprenter shop name");
  }
  if (!getSrAppClientId() || !getSrAppClientSecret()) {
    throw new Error("Hiányzik a SR_APP_CLIENT_ID / SR_APP_CLIENT_SECRET");
  }

  const storeUrl =
    normalizeStoreUrl(defaultStoreUrl(shopName)) || defaultStoreUrl(shopName);

  return withPlatformAdmin(async (client) => {
    await query(
      client,
      `update signup_intents
       set status = 'revoked'
       where shoprenter_shop_name = $1 and status = 'pending'`,
      [shopName],
    );

    const existing = await query<{
      shop_id: string;
      organization_id: string;
      public_id: string;
      store_url: string | null;
      status: string;
    }>(
      client,
      `select id as shop_id, organization_id, public_id, store_url, status
       from shops
       where lower(shoprenter_shop_name) = $1
       limit 1`,
      [shopName],
    );

    if (existing.rows[0]) {
      const row = existing.rows[0];
      const wasBad = ["uninstalled", "suspended", "needs_reauth", "draft"].includes(
        row.status,
      );
      await query(
        client,
        `update shops
         set status = 'active',
             store_url = coalesce(nullif(trim(store_url), ''), $2),
             updated_at = now()
         where id = $1`,
        [row.shop_id, storeUrl],
      );
      await upsertAppOAuthCredentials(client, row.shop_id);
      await query(
        client,
        `insert into shop_allowed_origins (shop_id, origin)
         values ($1, $2)
         on conflict do nothing`,
        [row.shop_id, originFromStoreUrl(storeUrl)],
      );
      const storeAfter = row.store_url?.trim() || storeUrl;
      return {
        shopId: row.shop_id,
        organizationId: row.organization_id,
        shopName,
        publicId: row.public_id,
        storeUrl: storeAfter,
        created: false,
        reactivated: wasBad,
      };
    }

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS_DEFAULT);
    const baseSlug = ensureSlug(`progate-${shopName}`);
    let finalSlug = baseSlug;
    for (let i = 0; i < 8; i++) {
      const clash = await query(
        client,
        `select 1 from organizations where slug = $1 limit 1`,
        [finalSlug],
      );
      if ((clash.rowCount ?? 0) === 0) break;
      finalSlug = `${baseSlug}-${i + 2}`;
    }

    let organizationId: string;
    try {
      const orgIns = await query<{ id: string }>(
        client,
        `insert into organizations (
           name, slug, status, plan, trial_ends_at, signup_source, purge_protected
         ) values ($1, $2, 'trial', 'start', $3, 'app_store', false)
         returning id`,
        [`ProGate · ${shopName}`, finalSlug, trialEnds.toISOString()],
      );
      organizationId = orgIns.rows[0].id;
    } catch (err) {
      // Pre-042 DB: signup_source check may not allow 'app_store' yet.
      console.warn(
        "[app-store] signup_source=app_store failed, fallback null",
        err,
      );
      const orgIns = await query<{ id: string }>(
        client,
        `insert into organizations (
           name, slug, status, plan, trial_ends_at, purge_protected
         ) values ($1, $2, 'trial', 'start', $3, false)
         returning id`,
        [`ProGate · ${shopName}`, finalSlug, trialEnds.toISOString()],
      );
      organizationId = orgIns.rows[0].id;
    }

    const shopIns = await query<{ id: string; public_id: string }>(
      client,
      `insert into shops (
         organization_id, shoprenter_shop_name, store_url, status, widget_enabled
       ) values ($1, $2, $3, 'active', false)
       returning id, public_id`,
      [organizationId, shopName, storeUrl],
    );
    const shopId = shopIns.rows[0].id;
    const publicId = shopIns.rows[0].public_id;

    await query(client, `insert into widget_settings (shop_id) values ($1)`, [
      shopId,
    ]);
    await upsertAppOAuthCredentials(client, shopId);
    await query(
      client,
      `insert into shop_allowed_origins (shop_id, origin)
       values ($1, $2)
       on conflict do nothing`,
      [shopId, originFromStoreUrl(storeUrl)],
    );

    await query(
      client,
      `insert into audit_events (organization_id, actor_user_id, action, meta)
       values ($1, null, 'org.created', $2::jsonb)`,
      [
        organizationId,
        JSON.stringify({
          source: "app_store",
          slug: finalSlug,
          shop: shopName,
        }),
      ],
    );

    return {
      shopId,
      organizationId,
      shopName,
      publicId,
      storeUrl,
      created: true,
      reactivated: false,
    };
  });
}

/** Non-blocking catalog bootstrap after App Store ensure. */
export function kickAppStoreBootstrapAfterEnsure(
  shop: EnsureAppStoreShopResult,
): void {
  const clientId = getSrAppClientId();
  const clientSecret = getSrAppClientSecret();
  if (!clientId || !clientSecret) return;

  const config: ShoprenterConfig = {
    shopName: shop.shopName,
    clientId,
    clientSecret,
    storeUrl: shop.storeUrl,
  };

  void withPlatformAdmin(async (client) => {
    try {
      await startShopBootstrap(
        client,
        shop.shopId,
        shop.organizationId,
        config,
        { force: shop.created },
      );
    } catch (err) {
      console.error("[app-store] bootstrap kick", shop.shopName, err);
      kickBootstrapWorkers();
    }
  }).catch((err) => {
    console.error("[app-store] bootstrap tx", shop.shopName, err);
  });
}
