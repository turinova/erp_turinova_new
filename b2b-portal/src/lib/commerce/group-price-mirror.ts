/**
 * Local mirror of Shoprenter customerGroupProductPrices.
 * /arak read path uses Postgres; SR is write + occasional full sync.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  listGroupPricesForGroup,
  type SrGroupPrice,
} from "@/lib/shoprenter/group-prices";

/** Default: 5 perc — page flip /arak közben ne menjen újra SR-re. */
export const GROUP_PRICE_MIRROR_MAX_AGE_MS = 5 * 60 * 1000;

export type MirroredGroupPrice = {
  productInnerId: number;
  priceNet: number;
  srPriceId: string | null;
};

type SyncMeta = {
  synced_at: Date | string;
  row_count: number;
  last_error: string | null;
};

const syncInFlight = new Map<string, Promise<SyncResult>>();

export type SyncResult = {
  synced: boolean;
  skipped: boolean;
  rowCount: number;
  durationMs: number;
  error?: string;
};

function lockKey(shopId: string, groupOuterId: string): string {
  return `${shopId}:${groupOuterId}`;
}

export async function getGroupPriceSyncMeta(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
): Promise<SyncMeta | null> {
  const res = await query<SyncMeta>(
    client,
    `select synced_at, row_count, last_error
     from partner_group_price_sync
     where shop_id = $1 and customer_group_outer_id = $2`,
    [shopId, customerGroupOuterId],
  );
  return res.rows[0] ?? null;
}

export function isMirrorFresh(
  meta: SyncMeta | null,
  maxAgeMs = GROUP_PRICE_MIRROR_MAX_AGE_MS,
): boolean {
  if (!meta?.synced_at) return false;
  const at = new Date(meta.synced_at).getTime();
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < maxAgeMs;
}

export async function mapMirroredPricesForInners(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
  productInnerIds: number[],
): Promise<Map<number, MirroredGroupPrice>> {
  const out = new Map<number, MirroredGroupPrice>();
  const unique = [
    ...new Set(
      productInnerIds
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.trunc(n)),
    ),
  ];
  if (!unique.length) return out;

  const res = await query<{
    product_inner_id: number;
    price_net: string;
    sr_price_id: string | null;
  }>(
    client,
    `select product_inner_id, price_net::text, sr_price_id
     from partner_group_prices
     where shop_id = $1
       and customer_group_outer_id = $2
       and product_inner_id = any($3::int[])`,
    [shopId, customerGroupOuterId, unique],
  );

  for (const row of res.rows) {
    const priceNet = Number(row.price_net);
    if (!Number.isFinite(priceNet)) continue;
    out.set(row.product_inner_id, {
      productInnerId: row.product_inner_id,
      priceNet: Math.round(priceNet),
      srPriceId: row.sr_price_id,
    });
  }
  return out;
}

export async function countMirroredGroupPrices(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
): Promise<number> {
  const meta = await getGroupPriceSyncMeta(
    client,
    shopId,
    customerGroupOuterId,
  );
  if (meta && isMirrorFresh(meta)) {
    return meta.row_count;
  }
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n
     from partner_group_prices
     where shop_id = $1 and customer_group_outer_id = $2`,
    [shopId, customerGroupOuterId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function upsertMirroredGroupPrice(
  client: PoolClient,
  opts: {
    shopId: string;
    customerGroupOuterId: string;
    productInnerId: number;
    priceNet: number;
    srPriceId: string | null;
  },
): Promise<void> {
  await query(
    client,
    `insert into partner_group_prices (
       shop_id, customer_group_outer_id, product_inner_id,
       price_net, sr_price_id, synced_at
     ) values ($1, $2, $3, $4, $5, now())
     on conflict (shop_id, customer_group_outer_id, product_inner_id)
     do update set
       price_net = excluded.price_net,
       sr_price_id = coalesce(excluded.sr_price_id, partner_group_prices.sr_price_id),
       synced_at = now()`,
    [
      opts.shopId,
      opts.customerGroupOuterId,
      opts.productInnerId,
      Math.round(opts.priceNet),
      opts.srPriceId,
    ],
  );
  await bumpSyncRowCount(client, opts.shopId, opts.customerGroupOuterId);
}

export async function deleteMirroredGroupPrice(
  client: PoolClient,
  opts: {
    shopId: string;
    customerGroupOuterId: string;
    productInnerId: number;
  },
): Promise<void> {
  await query(
    client,
    `delete from partner_group_prices
     where shop_id = $1
       and customer_group_outer_id = $2
       and product_inner_id = $3`,
    [opts.shopId, opts.customerGroupOuterId, opts.productInnerId],
  );
  await bumpSyncRowCount(client, opts.shopId, opts.customerGroupOuterId);
}

async function bumpSyncRowCount(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
): Promise<void> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n
     from partner_group_prices
     where shop_id = $1 and customer_group_outer_id = $2`,
    [shopId, customerGroupOuterId],
  );
  const n = Number(res.rows[0]?.n ?? 0);
  await query(
    client,
    `insert into partner_group_price_sync (
       shop_id, customer_group_outer_id, synced_at, row_count, last_error
     ) values ($1, $2, now(), $3, null)
     on conflict (shop_id, customer_group_outer_id)
     do update set
       row_count = excluded.row_count,
       last_error = null`,
    [shopId, customerGroupOuterId, n],
  );
}

/**
 * Full replace from Shoprenter for one customer group.
 * Call sparingly (cold / stale / ?resync=1).
 * SR fetch happens before DB writes; DB work uses a SAVEPOINT so failures
 * do not poison the outer tenant transaction.
 */
export async function replaceMirrorFromShoprenter(
  client: PoolClient,
  config: ShoprenterConfig,
  shopId: string,
  customerGroupOuterId: string,
): Promise<SyncResult> {
  const t0 = Date.now();

  let prices: SrGroupPrice[];
  try {
    prices = await listGroupPricesForGroup(config, customerGroupOuterId, {
      maxPages: 50,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    return {
      synced: false,
      skipped: false,
      rowCount: 0,
      durationMs: Date.now() - t0,
      error: message,
    };
  }

  const withInner = prices.filter(
    (p): p is SrGroupPrice & { productInnerId: number } =>
      p.productInnerId != null && p.productInnerId > 0,
  );

  await query(client, `savepoint partner_group_price_mirror`);
  try {
    await query(
      client,
      `delete from partner_group_prices
       where shop_id = $1 and customer_group_outer_id = $2`,
      [shopId, customerGroupOuterId],
    );

    const chunk = 100;
    for (let i = 0; i < withInner.length; i += chunk) {
      const slice = withInner.slice(i, i + chunk);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let p = 1;
      for (const row of slice) {
        placeholders.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, now())`,
        );
        values.push(
          shopId,
          customerGroupOuterId,
          row.productInnerId,
          Math.round(row.priceNet),
          row.id || null,
        );
      }
      if (!placeholders.length) continue;
      await query(
        client,
        `insert into partner_group_prices (
           shop_id, customer_group_outer_id, product_inner_id,
           price_net, sr_price_id, synced_at
         ) values ${placeholders.join(", ")}
         on conflict (shop_id, customer_group_outer_id, product_inner_id)
         do update set
           price_net = excluded.price_net,
           sr_price_id = excluded.sr_price_id,
           synced_at = now()`,
        values,
      );
    }

    await query(
      client,
      `insert into partner_group_price_sync (
         shop_id, customer_group_outer_id, synced_at, row_count, last_error
       ) values ($1, $2, now(), $3, null)
       on conflict (shop_id, customer_group_outer_id)
       do update set
         synced_at = excluded.synced_at,
         row_count = excluded.row_count,
         last_error = null`,
      [shopId, customerGroupOuterId, withInner.length],
    );

    await query(client, `release savepoint partner_group_price_mirror`);

    return {
      synced: true,
      skipped: false,
      rowCount: withInner.length,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    try {
      await query(
        client,
        `rollback to savepoint partner_group_price_mirror`,
      );
    } catch {
      /* outer txn may already be dead */
    }
    const message = err instanceof Error ? err.message : "sync failed";
    try {
      await query(client, `savepoint partner_group_price_mirror_err`);
      await query(
        client,
        `insert into partner_group_price_sync (
           shop_id, customer_group_outer_id, synced_at, row_count, last_error
         ) values ($1, $2, '1970-01-01'::timestamptz, 0, $3)
         on conflict (shop_id, customer_group_outer_id)
         do update set last_error = excluded.last_error`,
        [shopId, customerGroupOuterId, message.slice(0, 500)],
      );
      await query(client, `release savepoint partner_group_price_mirror_err`);
    } catch {
      /* ignore meta write */
    }
    return {
      synced: false,
      skipped: false,
      rowCount: 0,
      durationMs: Date.now() - t0,
      error: message,
    };
  }
}

/**
 * Ensure mirror is fresh enough for /arak reads.
 * Concurrent callers share one in-flight sync per shop×group.
 */
export async function ensureGroupPriceMirror(
  client: PoolClient,
  config: ShoprenterConfig,
  shopId: string,
  customerGroupOuterId: string,
  opts?: { force?: boolean; maxAgeMs?: number },
): Promise<SyncResult> {
  const maxAgeMs = opts?.maxAgeMs ?? GROUP_PRICE_MIRROR_MAX_AGE_MS;
  const force = Boolean(opts?.force);

  if (!force) {
    const meta = await getGroupPriceSyncMeta(
      client,
      shopId,
      customerGroupOuterId,
    );
    if (isMirrorFresh(meta, maxAgeMs)) {
      return {
        synced: false,
        skipped: true,
        rowCount: meta?.row_count ?? 0,
        durationMs: 0,
      };
    }
  }

  const key = lockKey(shopId, customerGroupOuterId);
  const existing = syncInFlight.get(key);
  if (existing) return existing;

  const promise = replaceMirrorFromShoprenter(
    client,
    config,
    shopId,
    customerGroupOuterId,
  ).finally(() => {
    syncInFlight.delete(key);
  });
  syncInFlight.set(key, promise);
  return promise;
}

/** In-memory manufacturers cache (DB aggregate is cheap; still skip repeat). */
const mfrCache = new Map<
  string,
  { at: number; rows: import("@/lib/commerce/lookup").CatalogManufacturer[] }
>();
const MFR_TTL_MS = 60_000;

export async function listManufacturersCached(
  client: PoolClient,
  shopId: string,
  loader: (
    c: PoolClient,
    id: string,
  ) => Promise<import("@/lib/commerce/lookup").CatalogManufacturer[]>,
): Promise<import("@/lib/commerce/lookup").CatalogManufacturer[]> {
  const hit = mfrCache.get(shopId);
  if (hit && Date.now() - hit.at < MFR_TTL_MS) return hit.rows;
  const rows = await loader(client, shopId);
  mfrCache.set(shopId, { at: Date.now(), rows });
  return rows;
}
