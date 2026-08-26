/**
 * Cross-tenant group-rules scheduling (manual / daily / hourly / on_order).
 * Rate-limit friendly: batch ticks claim one shop; on_order evaluates 1 customer.
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
  // eslint-disable-next-line no-var
  var __b2bGroupRulesOnOrderDebounce: Map<string, number> | undefined;
}

export type GroupRulesSchedule =
  | "manual"
  | "daily"
  | "on_order"
  | "hourly";

export type ShopAutoSettings = {
  schedule: GroupRulesSchedule;
  /** Derived: anything other than manual */
  autoEnabled: boolean;
  lastRunAt: string | null;
};

const SCHEDULES = new Set<GroupRulesSchedule>([
  "manual",
  "daily",
  "on_order",
  "hourly",
]);

function parseSchedule(raw: string | null | undefined): GroupRulesSchedule {
  if (raw && SCHEDULES.has(raw as GroupRulesSchedule)) {
    return raw as GroupRulesSchedule;
  }
  return "manual";
}

export async function getShopGroupRulesAuto(
  client: PoolClient,
  shopId: string,
): Promise<ShopAutoSettings> {
  await ensurePartnerGroupRulesSchema();
  const res = await query<{
    group_rules_schedule: string | null;
    group_rules_auto_enabled: boolean;
    group_rules_auto_last_run_at: string | null;
  }>(
    client,
    `select group_rules_schedule,
            group_rules_auto_enabled,
            group_rules_auto_last_run_at::text
     from shops where id = $1`,
    [shopId],
  );
  const row = res.rows[0];
  let schedule = parseSchedule(row?.group_rules_schedule);
  /* Legacy: boolean on, schedule still default manual */
  if (schedule === "manual" && row?.group_rules_auto_enabled) {
    schedule = "daily";
  }
  return {
    schedule,
    autoEnabled: schedule !== "manual",
    lastRunAt: row?.group_rules_auto_last_run_at ?? null,
  };
}

export async function setShopGroupRulesSchedule(
  client: PoolClient,
  shopId: string,
  schedule: GroupRulesSchedule,
): Promise<ShopAutoSettings> {
  await ensurePartnerGroupRulesSchema();
  const next = parseSchedule(schedule);
  const res = await query<{
    group_rules_schedule: string;
    group_rules_auto_last_run_at: string | null;
  }>(
    client,
    `update shops
     set group_rules_schedule = $2,
         group_rules_auto_enabled = ($2 <> 'manual'),
         updated_at = now()
     where id = $1
     returning group_rules_schedule,
               group_rules_auto_last_run_at::text`,
    [shopId, next],
  );
  const row = res.rows[0];
  const s = parseSchedule(row?.group_rules_schedule);
  return {
    schedule: s,
    autoEnabled: s !== "manual",
    lastRunAt: row?.group_rules_auto_last_run_at ?? null,
  };
}

/** @deprecated use setShopGroupRulesSchedule */
export async function setShopGroupRulesAuto(
  client: PoolClient,
  shopId: string,
  enabled: boolean,
): Promise<ShopAutoSettings> {
  return setShopGroupRulesSchedule(
    client,
    shopId,
    enabled ? "daily" : "manual",
  );
}

type DueShop = {
  id: string;
  organization_id: string;
  shoprenter_shop_name: string;
  group_rules_schedule: string;
};

async function claimDueShop(
  mode: "daily" | "hourly",
): Promise<DueShop | null> {
  return withPlatformAdmin(async (client) => {
    await ensurePartnerGroupRulesSchema();
    const dueFilter =
      mode === "hourly"
        ? `group_rules_schedule = 'hourly'
           and (
             group_rules_auto_last_run_at is null
             or group_rules_auto_last_run_at < now() - interval '55 minutes'
           )`
        : `group_rules_schedule = 'daily'
           and (
             group_rules_auto_last_run_at is null
             or (group_rules_auto_last_run_at at time zone 'Europe/Budapest')::date
                < (now() at time zone 'Europe/Budapest')::date
           )`;

    const res = await query<DueShop>(
      client,
      `with due as (
         select id
         from shops
         where purged_at is null
           and status in ('active', 'draft')
           and ${dueFilter}
         order by group_rules_auto_last_run_at nulls first
         limit 1
         for update skip locked
       )
       update shops s
       set group_rules_auto_last_run_at = now(),
           updated_at = now()
       from due
       where s.id = due.id
       returning s.id, s.organization_id, s.shoprenter_shop_name, s.group_rules_schedule`,
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
          maxCustomers: opts.maxCustomers ?? 40,
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

async function claimAndRun(
  mode: "daily" | "hourly",
): Promise<{ ran: boolean; shopId?: string; applied?: number; error?: string }> {
  const shop = await claimDueShop(mode);
  if (!shop) return { ran: false };

  const result = await runGroupRulesForShop({
    shopId: shop.id,
    organizationId: shop.organization_id,
    shopName: shop.shoprenter_shop_name,
    maxCustomers: mode === "hourly" ? 25 : 40,
  });

  if (result.error) {
    console.warn("[group-rules-auto]", mode, shop.id, result.error);
    return { ran: true, shopId: shop.id, applied: 0, error: result.error };
  }

  console.info(
    "[group-rules-auto]",
    mode,
    shop.id,
    `scanned=${result.scanned} applied=${result.applied}`,
  );
  return { ran: true, shopId: shop.id, applied: result.applied };
}

/**
 * Process at most one due shop (hourly preferred, then daily).
 */
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
    const hourly = await claimAndRun("hourly");
    if (hourly.ran) return hourly;
    return claimAndRun("daily");
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

const ON_ORDER_DEBOUNCE_MS = 3 * 60_000;

/**
 * After a widget/order event: evaluate one customer if shop schedule is on_order.
 * Fire-and-forget safe; respects Shoprenter by debouncing 3 min / customer.
 */
export async function maybeRunGroupRulesAfterOrder(opts: {
  shopId: string;
  organizationId: string;
  customerInnerId: number;
}): Promise<void> {
  if (!opts.customerInnerId || opts.customerInnerId <= 0) return;

  const debounceKey = `${opts.shopId}:${opts.customerInnerId}`;
  if (!global.__b2bGroupRulesOnOrderDebounce) {
    global.__b2bGroupRulesOnOrderDebounce = new Map();
  }
  const last = global.__b2bGroupRulesOnOrderDebounce.get(debounceKey) ?? 0;
  if (Date.now() - last < ON_ORDER_DEBOUNCE_MS) return;
  global.__b2bGroupRulesOnOrderDebounce.set(debounceKey, Date.now());

  try {
    const shopMeta = await withPlatformAdmin(async (client) => {
      await ensurePartnerGroupRulesSchema();
      const res = await query<{
        group_rules_schedule: string;
        shoprenter_shop_name: string;
      }>(
        client,
        `select group_rules_schedule, shoprenter_shop_name
         from shops where id = $1`,
        [opts.shopId],
      );
      return res.rows[0] ?? null;
    });
    if (!shopMeta) return;
    if (parseSchedule(shopMeta.group_rules_schedule) !== "on_order") return;

    const result = await runGroupRulesForShop({
      shopId: opts.shopId,
      organizationId: opts.organizationId,
      shopName: shopMeta.shoprenter_shop_name,
      onlyCustomerInnerIds: [opts.customerInnerId],
    });

    await withPlatformAdmin(async (client) => {
      await query(
        client,
        `update shops
         set group_rules_auto_last_run_at = now(), updated_at = now()
         where id = $1`,
        [opts.shopId],
      );
    });

    if (result.error) {
      console.warn("[group-rules-on-order]", opts.shopId, result.error);
    } else if (result.applied > 0) {
      console.info(
        "[group-rules-on-order]",
        opts.shopId,
        `customer=${opts.customerInnerId} applied=${result.applied}`,
      );
    }
  } catch (e) {
    console.warn(
      "[group-rules-on-order]",
      e instanceof Error ? e.message : e,
    );
  }
}
