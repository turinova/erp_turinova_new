/**
 * Cross-tenant group-rules scheduling.
 * Product model: nightly (Europe/Budapest) for shops with enabled rules + manual run.
 * Legacy schedule values (hourly / on_order / manual) are ignored for claiming.
 */

import type { PoolClient } from "pg";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin, withTenant } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import { evaluateGroupRules } from "@/lib/merchant/group-rules";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import type { ShopCredentialsPlain } from "@/types/db";

declare global {
  // eslint-disable-next-line no-var
  var __b2bGroupRulesAutoBusy: boolean | undefined;
}

/** Kept for DB/API compat — product always behaves as daily. */
export type GroupRulesSchedule =
  | "manual"
  | "daily"
  | "on_order"
  | "hourly";

export type ShopAutoSettings = {
  schedule: "daily";
  autoEnabled: true;
  lastRunAt: string | null;
};

/** Ensure shop is on nightly schedule (idempotent). */
export async function ensureShopGroupRulesDaily(
  client: PoolClient,
  shopId: string,
): Promise<ShopAutoSettings> {
  await ensurePartnerGroupRulesSchema();
  const res = await query<{
    group_rules_auto_last_run_at: string | null;
  }>(
    client,
    `update shops
     set group_rules_schedule = 'daily',
         group_rules_auto_enabled = true,
         updated_at = now()
     where id = $1
       and (
         group_rules_schedule is distinct from 'daily'
         or group_rules_auto_enabled is not true
       )
     returning group_rules_auto_last_run_at::text`,
    [shopId],
  );
  if (res.rows[0]) {
    return {
      schedule: "daily",
      autoEnabled: true,
      lastRunAt: res.rows[0].group_rules_auto_last_run_at,
    };
  }
  return getShopGroupRulesAuto(client, shopId);
}

export async function getShopGroupRulesAuto(
  client: PoolClient,
  shopId: string,
): Promise<ShopAutoSettings> {
  await ensurePartnerGroupRulesSchema();
  const res = await query<{
    group_rules_auto_last_run_at: string | null;
  }>(
    client,
    `select group_rules_auto_last_run_at::text
     from shops where id = $1`,
    [shopId],
  );
  return {
    schedule: "daily",
    autoEnabled: true,
    lastRunAt: res.rows[0]?.group_rules_auto_last_run_at ?? null,
  };
}

export async function setShopGroupRulesSchedule(
  client: PoolClient,
  shopId: string,
  _schedule?: GroupRulesSchedule,
): Promise<ShopAutoSettings> {
  /* Product: always nightly — ignore requested schedule. */
  void _schedule;
  await ensurePartnerGroupRulesSchema();
  const res = await query<{
    group_rules_auto_last_run_at: string | null;
  }>(
    client,
    `update shops
     set group_rules_schedule = 'daily',
         group_rules_auto_enabled = true,
         updated_at = now()
     where id = $1
     returning group_rules_auto_last_run_at::text`,
    [shopId],
  );
  return {
    schedule: "daily",
    autoEnabled: true,
    lastRunAt: res.rows[0]?.group_rules_auto_last_run_at ?? null,
  };
}

/** @deprecated use setShopGroupRulesSchedule */
export async function setShopGroupRulesAuto(
  client: PoolClient,
  shopId: string,
  _enabled: boolean,
): Promise<ShopAutoSettings> {
  void _enabled;
  return setShopGroupRulesSchedule(client, shopId, "daily");
}

type DueShop = {
  id: string;
  organization_id: string;
  shoprenter_shop_name: string;
};

/**
 * Claim one shop that has enabled rules and has not run yet today (Budapest).
 */
async function claimDueShop(): Promise<DueShop | null> {
  return withPlatformAdmin(async (client) => {
    await ensurePartnerGroupRulesSchema();

    const res = await query<DueShop>(
      client,
      `with due as (
         select s.id
         from shops s
         where s.purged_at is null
           and s.status in ('active', 'draft')
           and exists (
             select 1
             from partner_group_rules r
             where r.shop_id = s.id
               and r.enabled
           )
           and (
             s.group_rules_auto_last_run_at is null
             or (s.group_rules_auto_last_run_at at time zone 'Europe/Budapest')::date
                < (now() at time zone 'Europe/Budapest')::date
           )
         order by s.group_rules_auto_last_run_at nulls first
         limit 1
         for update of s skip locked
       )
       update shops s
       set group_rules_auto_last_run_at = now(),
           group_rules_schedule = 'daily',
           group_rules_auto_enabled = true,
           updated_at = now()
       from due
       where s.id = due.id
       returning s.id, s.organization_id, s.shoprenter_shop_name`,
    );
    return res.rows[0] ?? null;
  });
}

async function loadConfigForShop(
  shopId: string,
  shopName: string,
): Promise<ReturnType<typeof configFromCredentials> | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<{
      auth_type: "oauth" | "basic_legacy";
      ciphertext: Buffer;
      iv: Buffer;
      key_version: number;
    }>(
      client,
      `select auth_type, ciphertext, iv, key_version
       from shop_credentials where shop_id = $1`,
      [shopId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const plain = decryptCredentials({
      ciphertext: Buffer.from(row.ciphertext),
      iv: Buffer.from(row.iv),
      key_version: row.key_version,
    }) as ShopCredentialsPlain;
    return configFromCredentials(shopName, plain);
  });
}

export async function runGroupRulesForShop(opts: {
  shopId: string;
  organizationId: string;
  shopName: string;
  onlyCustomerInnerIds?: number[];
  maxCustomers?: number;
}): Promise<{ applied: number; scanned: number; hits: number; error?: string }> {
  const config = await loadConfigForShop(opts.shopId, opts.shopName);
  if (!config) {
    return { applied: 0, scanned: 0, hits: 0, error: "no_creds" };
  }

  try {
    const result = await withTenant(
      {
        organizationId: opts.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      async (client) =>
        evaluateGroupRules({
          client,
          config,
          shopId: opts.shopId,
          orgId: opts.organizationId,
          actorUserId: null,
          dryRun: false,
          maxCustomers: opts.maxCustomers ?? 120,
          onlyCustomerInnerIds: opts.onlyCustomerInnerIds,
        }),
    );
    return {
      applied: result.applied,
      scanned: result.scanned,
      hits: result.hits.length,
    };
  } catch (e) {
    return {
      applied: 0,
      scanned: 0,
      hits: 0,
      error: e instanceof Error ? e.message : "eval_failed",
    };
  }
}

async function claimAndRun(): Promise<{
  ran: boolean;
  shopId?: string;
  applied?: number;
  error?: string;
}> {
  const shop = await claimDueShop();
  if (!shop) return { ran: false };

  const result = await runGroupRulesForShop({
    shopId: shop.id,
    organizationId: shop.organization_id,
    shopName: shop.shoprenter_shop_name,
    maxCustomers: 120,
  });

  if (result.error) {
    console.warn("[group-rules-auto]", "daily", shop.id, result.error);
    return { ran: true, shopId: shop.id, applied: 0, error: result.error };
  }

  console.info(
    "[group-rules-auto]",
    "daily",
    shop.id,
    `scanned=${result.scanned} applied=${result.applied}`,
  );
  return { ran: true, shopId: shop.id, applied: result.applied };
}

/** Process at most one due shop (nightly batch). */
export async function processGroupRulesAutoTick(): Promise<{
  ran: boolean;
  shopId?: string;
  applied?: number;
  error?: string;
}> {
  if (global.__b2bGroupRulesAutoBusy) return { ran: false };
  global.__b2bGroupRulesAutoBusy = true;
  try {
    await ensurePartnerGroupRulesSchema();
    return claimAndRun();
  } finally {
    global.__b2bGroupRulesAutoBusy = false;
  }
}

export async function processGroupRulesAutoBatch(
  maxShops = 20,
): Promise<{ processed: number; applied: number }> {
  let processed = 0;
  let applied = 0;
  for (let i = 0; i < maxShops; i++) {
    const r = await processGroupRulesAutoTick();
    if (!r.ran) break;
    processed += 1;
    applied += r.applied ?? 0;
  }
  return { processed, applied };
}

/**
 * Legacy on_order path — disabled (product is nightly + manual only).
 */
export async function maybeRunGroupRulesAfterOrder(_opts: {
  shopId: string;
  organizationId: string;
  customerInnerId: number;
}): Promise<void> {
  void _opts;
}
