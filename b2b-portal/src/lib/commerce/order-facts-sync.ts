/**
 * Shoprenter → Postgres order facts sync (riport mirror).
 * Tables come from manual sql/029 — app never runs DDL.
 * If tables are missing, tick/kick no-op gracefully.
 */

import type { PoolClient } from "pg";
import { query, withPlatformAdmin } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  getOrderDetailById,
  listShopOrders,
  parseShoprenterOrderTime,
  type CustomerOrderLine,
  type CustomerOrderSummary,
  type ShoprenterConfig,
} from "@/lib/shoprenter";

const LOOKBACK_MS = 800 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHOPS_PER_TICK = 2;
const LIST_MAX_PAGES = 4;
const LIST_LIMIT = 50;
const BACKFILL_LINES_PER_TICK = 20;
const HIST_BACKFILL_PAGES = 4;

const FEE_RE = /szallit|shipping|utanvet|cod|freight/i;

let tickBusy = false;

function parseOrderTime(raw: string | null | undefined): number {
  return parseShoprenterOrderTime(raw);
}

function skuNorm(sku: string | null | undefined): string | null {
  if (!sku || !sku.trim()) return null;
  return sku.trim().toUpperCase();
}

function isFeeOrShippingLine(line: {
  sku?: string;
  name?: string;
  modelNumber?: string;
}): boolean {
  const hay = `${line.name || ""} ${line.sku || ""} ${line.modelNumber || ""}`;
  return FEE_RE.test(hay);
}

function lineGrossOf(line: CustomerOrderLine): number {
  if (line.lineTotalGross != null && Number.isFinite(line.lineTotalGross)) {
    return Math.round(line.lineTotalGross);
  }
  if (line.priceGross != null && Number.isFinite(line.priceGross)) {
    return Math.round(line.priceGross * (line.quantity || 1));
  }
  return 0;
}

function lineNetOf(line: CustomerOrderLine): number | null {
  if (line.lineTotalNet != null && Number.isFinite(line.lineTotalNet)) {
    return Math.round(line.lineTotalNet);
  }
  if (line.priceNet != null && Number.isFinite(line.priceNet)) {
    return Math.round(line.priceNet * (line.quantity || 1));
  }
  return null;
}

async function schemaReady(client: PoolClient): Promise<boolean> {
  const res = await query<{ reg: string | null }>(
    client,
    `select to_regclass('public.shop_order_facts')::text as reg`,
  );
  return Boolean(res.rows[0]?.reg);
}

type ShopPick = {
  id: string;
  organization_id: string;
  newest_synced_at: Date | null;
  oldest_synced_at: Date | null;
};

async function pickShops(
  client: PoolClient,
  limit: number,
): Promise<ShopPick[]> {
  const res = await query<ShopPick>(
    client,
    `select s.id, s.organization_id,
            st.newest_synced_at, st.oldest_synced_at
     from shops s
     left join shop_report_sync_state st on st.shop_id = s.id
     where s.purged_at is null
       and (st.status is null or st.status <> 'running')
     order by st.last_run_at nulls first
     limit $1`,
    [limit],
  );
  return res.rows;
}

async function markRunning(client: PoolClient, shopId: string): Promise<void> {
  await query(
    client,
    `insert into shop_report_sync_state (shop_id, status, last_run_at, last_error)
     values ($1, 'running', now(), null)
     on conflict (shop_id) do update set
       status = 'running',
       last_error = null`,
    [shopId],
  );
}

async function markIdle(
  client: PoolClient,
  shopId: string,
  oldest: Date | null,
  newest: Date | null,
): Promise<void> {
  await query(
    client,
    `insert into shop_report_sync_state (
       shop_id, status, last_run_at, last_error,
       oldest_synced_at, newest_synced_at
     ) values (
       $1, 'idle', now(), null, $2, $3
     )
     on conflict (shop_id) do update set
       status = 'idle',
       last_run_at = now(),
       last_error = null,
       oldest_synced_at = case
         when excluded.oldest_synced_at is null
           then shop_report_sync_state.oldest_synced_at
         when shop_report_sync_state.oldest_synced_at is null
           then excluded.oldest_synced_at
         else least(
           shop_report_sync_state.oldest_synced_at,
           excluded.oldest_synced_at
         )
       end,
       newest_synced_at = case
         when excluded.newest_synced_at is null
           then shop_report_sync_state.newest_synced_at
         when shop_report_sync_state.newest_synced_at is null
           then excluded.newest_synced_at
         else greatest(
           shop_report_sync_state.newest_synced_at,
           excluded.newest_synced_at
         )
       end`,
    [shopId, oldest, newest],
  );
}

async function markError(
  client: PoolClient,
  shopId: string,
  message: string,
): Promise<void> {
  await query(
    client,
    `insert into shop_report_sync_state (shop_id, status, last_run_at, last_error)
     values ($1, 'error', now(), $2)
     on conflict (shop_id) do update set
       status = 'error',
       last_run_at = now(),
       last_error = excluded.last_error`,
    [shopId, message.slice(0, 500)],
  );
}

async function widgetOrderIds(
  client: PoolClient,
  shopId: string,
  srOrderIds: string[],
): Promise<Set<string>> {
  if (!srOrderIds.length) return new Set();
  const res = await query<{ sr_order_id: string }>(
    client,
    `select sr_order_id
     from b2b_orders
     where shop_id = $1
       and sr_order_id = any($2::text[])
       and sr_order_id is not null`,
    [shopId, srOrderIds],
  );
  return new Set(res.rows.map((r) => r.sr_order_id));
}

async function groupByCustomerInner(
  client: PoolClient,
  shopId: string,
  inners: number[],
): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>();
  if (!inners.length) return map;
  const res = await query<{
    sr_customer_inner_id: number;
    sr_group_inner_id: number | null;
  }>(
    client,
    `select sr_customer_inner_id, sr_group_inner_id
     from shop_customers
     where shop_id = $1
       and sr_customer_inner_id = any($2::int[])`,
    [shopId, inners],
  );
  for (const row of res.rows) {
    map.set(row.sr_customer_inner_id, row.sr_group_inner_id);
  }
  return map;
}

async function replaceLineFacts(
  client: PoolClient,
  shopId: string,
  orderFactId: string,
  srOrderId: string,
  lines: CustomerOrderLine[],
): Promise<void> {
  await query(
    client,
    `delete from shop_order_line_facts where order_fact_id = $1`,
    [orderFactId],
  );
  for (const line of lines) {
    const sku = line.sku?.trim() || null;
    await query(
      client,
      `insert into shop_order_line_facts (
         shop_id, order_fact_id, sr_order_id, sku, sku_norm,
         model_number, name, quantity, line_gross, line_net,
         is_fee_or_shipping
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        shopId,
        orderFactId,
        srOrderId,
        sku,
        skuNorm(sku),
        line.modelNumber?.trim() || null,
        line.name?.trim() || null,
        line.quantity ?? 1,
        lineGrossOf(line),
        lineNetOf(line),
        isFeeOrShippingLine(line),
      ],
    );
  }
}

async function upsertOrderFact(
  client: PoolClient,
  shopId: string,
  order: CustomerOrderSummary,
  sourceGuess: "widget" | "store",
  groupInnerId: number | null,
): Promise<{ id: string; wroteLines: boolean }> {
  const t = parseOrderTime(order.dateCreated);
  if (!t) {
    throw new Error(`Invalid order date: ${order.dateCreated || "(empty)"}`);
  }
  const dateCreated = new Date(t);
  const hasLines = Boolean(order.lines?.length);
  const totalGross = Math.round(order.totalGross ?? order.total ?? 0);
  const totalNet =
    order.totalNet != null && Number.isFinite(order.totalNet)
      ? Math.round(order.totalNet)
      : null;
  const shippingGross = Math.round(order.shippingGross ?? order.shippingNet ?? 0);
  const discountGross = Math.round(order.discountGross ?? 0);
  const rawMeta = {
    itemCount: order.itemCount,
    paymentGross: order.paymentGross ?? null,
    couponCode: order.couponCode ?? null,
    statusColor: order.statusColor ?? null,
  };

  const res = await query<{ id: string }>(
    client,
    `insert into shop_order_facts (
       shop_id, sr_order_id, sr_order_inner_id, date_created,
       email, customer_name, sr_customer_inner_id, sr_group_inner_id,
       status_id, status_name, total_gross, total_net,
       shipping_gross, discount_gross, currency, source_guess,
       raw_meta, lines_synced_at, synced_at
     ) values (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12,
       $13, $14, 'HUF', $15,
       $16::jsonb, $17, now()
     )
     on conflict (shop_id, sr_order_id) do update set
       sr_order_inner_id = excluded.sr_order_inner_id,
       date_created = excluded.date_created,
       email = excluded.email,
       customer_name = excluded.customer_name,
       sr_customer_inner_id = excluded.sr_customer_inner_id,
       sr_group_inner_id = coalesce(
         excluded.sr_group_inner_id,
         shop_order_facts.sr_group_inner_id
       ),
       status_id = excluded.status_id,
       status_name = excluded.status_name,
       total_gross = excluded.total_gross,
       total_net = excluded.total_net,
       shipping_gross = excluded.shipping_gross,
       discount_gross = excluded.discount_gross,
       source_guess = excluded.source_guess,
       raw_meta = excluded.raw_meta,
       lines_synced_at = case
         when excluded.lines_synced_at is not null
           then excluded.lines_synced_at
         else shop_order_facts.lines_synced_at
       end,
       synced_at = now()
     returning id`,
    [
      shopId,
      order.id,
      order.innerId || null,
      dateCreated,
      order.email ?? null,
      order.customerName ?? null,
      order.customerInnerId ?? null,
      groupInnerId,
      order.statusId ?? null,
      order.status || null,
      totalGross,
      totalNet,
      shippingGross,
      discountGross,
      sourceGuess,
      JSON.stringify(rawMeta),
      hasLines ? new Date() : null,
    ],
  );

  const id = res.rows[0]!.id;
  if (hasLines && order.lines) {
    await replaceLineFacts(client, shopId, id, order.id, order.lines);
    return { id, wroteLines: true };
  }
  return { id, wroteLines: false };
}

async function upsertOrdersBatch(
  client: PoolClient,
  shopId: string,
  orders: CustomerOrderSummary[],
): Promise<{ oldest: Date | null; newest: Date | null; count: number }> {
  let oldest: Date | null = null;
  let newest: Date | null = null;
  if (!orders.length) return { oldest, newest, count: 0 };

  const widgetIds = await widgetOrderIds(
    client,
    shopId,
    orders.map((o) => o.id),
  );
  const inners = [
    ...new Set(
      orders
        .map((o) => o.customerInnerId)
        .filter((n): n is number => n != null && Number.isFinite(n)),
    ),
  ];
  const groups = await groupByCustomerInner(client, shopId, inners);

  let count = 0;
  for (const order of orders) {
    const t = parseOrderTime(order.dateCreated);
    if (!t) continue;
    const d = new Date(t);
    if (!oldest || d < oldest) oldest = d;
    if (!newest || d > newest) newest = d;

    const sourceGuess: "widget" | "store" = widgetIds.has(order.id)
      ? "widget"
      : "store";
    const groupInnerId =
      order.customerInnerId != null
        ? (groups.get(order.customerInnerId) ?? null)
        : null;
    await upsertOrderFact(client, shopId, order, sourceGuess, groupInnerId);
    count++;
  }
  return { oldest, newest, count };
}

async function backfillMissingLines(
  client: PoolClient,
  shopId: string,
  config: ShoprenterConfig,
): Promise<number> {
  const res = await query<{ id: string; sr_order_id: string }>(
    client,
    `select id, sr_order_id
     from shop_order_facts
     where shop_id = $1
       and lines_synced_at is null
     order by date_created desc
     limit $2`,
    [shopId, BACKFILL_LINES_PER_TICK],
  );
  if (!res.rows.length) return 0;

  // Release DB work: fetch details outside this transaction when possible.
  // Here we still hold client (kick / tick upsert txn) — fetch then write.
  let n = 0;
  for (const row of res.rows) {
    try {
      const detail = await getOrderDetailById(config, row.sr_order_id);
      if (!detail.lines?.length) {
        // Mark synced with empty lines so we don't retry forever.
        await query(
          client,
          `update shop_order_facts
           set lines_synced_at = now(), synced_at = now()
           where id = $1`,
          [row.id],
        );
        n++;
        continue;
      }
      await replaceLineFacts(
        client,
        shopId,
        row.id,
        row.sr_order_id,
        detail.lines,
      );
      await query(
        client,
        `update shop_order_facts
         set lines_synced_at = now(),
             status_id = coalesce($2, status_id),
             status_name = coalesce($3, status_name),
             total_gross = coalesce($4, total_gross),
             total_net = coalesce($5, total_net),
             shipping_gross = coalesce($6, shipping_gross),
             discount_gross = coalesce($7, discount_gross),
             synced_at = now()
         where id = $1`,
        [
          row.id,
          detail.statusId ?? null,
          detail.status || null,
          detail.totalGross != null
            ? Math.round(detail.totalGross)
            : Math.round(detail.total ?? 0),
          detail.totalNet != null ? Math.round(detail.totalNet) : null,
          Math.round(detail.shippingGross ?? detail.shippingNet ?? 0),
          Math.round(detail.discountGross ?? 0),
        ],
      );
      n++;
    } catch (err) {
      console.warn(
        "[order-facts] backfill line failed",
        shopId,
        row.sr_order_id,
        err,
      );
    }
  }
  return n;
}

/**
 * Core sync for one shop (expects schema already present).
 * 1) Catch up recent orders from newest cursor
 * 2) Backfill older history until LOOKBACK when needed
 */
async function syncOneShop(
  client: PoolClient,
  opts: {
    shopId: string;
    config: ShoprenterConfig;
    newestSyncedAt: Date | string | null;
    oldestSyncedAt?: Date | string | null;
  },
): Promise<{ orderCount: number }> {
  const now = Date.now();
  const lookbackFrom = now - LOOKBACK_MS;
  const newestMs = opts.newestSyncedAt
    ? new Date(opts.newestSyncedAt).getTime()
    : 0;
  const oldestMs = opts.oldestSyncedAt
    ? new Date(opts.oldestSyncedAt).getTime()
    : 0;

  const recentFrom =
    newestMs && Number.isFinite(newestMs) ? newestMs - DAY_MS : lookbackFrom;

  const recent = await listShopOrders(opts.config, {
    dateFromMs: recentFrom,
    dateToMs: now,
    maxPages: LIST_MAX_PAGES,
    limit: LIST_LIMIT,
  });

  let historical: CustomerOrderSummary[] = [];
  const needHist =
    !oldestMs ||
    !Number.isFinite(oldestMs) ||
    oldestMs > lookbackFrom + DAY_MS * 7;

  if (needHist) {
    const histTo =
      oldestMs && Number.isFinite(oldestMs) ? oldestMs : now;
    historical = await listShopOrders(opts.config, {
      dateFromMs: lookbackFrom,
      dateToMs: histTo,
      maxPages: HIST_BACKFILL_PAGES,
      limit: LIST_LIMIT,
    });
  }

  const byId = new Map<string, CustomerOrderSummary>();
  for (const o of [...recent, ...historical]) byId.set(o.id, o);
  const orders = [...byId.values()];

  const batch = await upsertOrdersBatch(client, opts.shopId, orders);
  await backfillMissingLines(client, opts.shopId, opts.config);
  await markIdle(client, opts.shopId, batch.oldest, batch.newest);
  return { orderCount: batch.count };
}

/**
 * Background tick: up to 2 shops, list pages + line backfill.
 * No-ops if sql/029 not applied.
 */
export async function processOrderFactsSyncTick(): Promise<{
  processed: number;
  error?: string;
}> {
  if (tickBusy) return { processed: 0 };
  tickBusy = true;
  try {
    type Claimed = {
      shopId: string;
      config: ShoprenterConfig;
      newestSyncedAt: Date | null;
      oldestSyncedAt: Date | null;
    };

    const claimed = await withPlatformAdmin(async (client) => {
      if (!(await schemaReady(client))) return null;
      const shops = await pickShops(client, SHOPS_PER_TICK);
      const out: Claimed[] = [];
      for (const s of shops) {
        await markRunning(client, s.id);
        const loaded = await loadMerchantShoprenterConfig(
          client,
          s.organization_id,
        );
        if (!loaded) {
          await markError(client, s.id, "Nincs API kulcs");
          continue;
        }
        out.push({
          shopId: loaded.shopId,
          config: loaded.config,
          newestSyncedAt: s.newest_synced_at,
          oldestSyncedAt: s.oldest_synced_at,
        });
      }
      return out;
    });

    if (claimed === null) return { processed: 0 };
    if (!claimed.length) return { processed: 0 };

    let processed = 0;
    let lastError: string | undefined;

    for (const shop of claimed) {
      try {
        await withPlatformAdmin(async (client) => {
          await syncOneShop(client, {
            shopId: shop.shopId,
            config: shop.config,
            newestSyncedAt: shop.newestSyncedAt,
            oldestSyncedAt: shop.oldestSyncedAt,
          });
        });
        processed += 1;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "order-facts sync failed";
        lastError = message;
        console.error("[order-facts]", shop.shopId, err);
        try {
          await withPlatformAdmin((client) =>
            markError(client, shop.shopId, message),
          );
        } catch (inner) {
          console.error("[order-facts] mark-error", inner);
        }
      }
    }

    return lastError
      ? { processed, error: lastError }
      : { processed };
  } finally {
    tickBusy = false;
  }
}

/**
 * Merchant/admin kick: sync one org's shop inline on the given client.
 */
export async function kickOrderFactsForOrg(
  client: PoolClient,
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  if (!(await schemaReady(client))) {
    return {
      ok: false,
      message: "Rendelés-tükör táblák hiányoznak. Futtasd a 029 SQL-t.",
    };
  }

  const loaded = await loadMerchantShoprenterConfig(client, organizationId);
  if (!loaded) {
    return { ok: false, message: "Nincs bolt vagy API kulcs ehhez a szervezethez." };
  }

  const state = await query<{
    newest_synced_at: Date | null;
    oldest_synced_at: Date | null;
    status: string | null;
  }>(
    client,
    `select newest_synced_at, oldest_synced_at, status
     from shop_report_sync_state
     where shop_id = $1`,
    [loaded.shopId],
  );

  try {
    await markRunning(client, loaded.shopId);
    const result = await syncOneShop(client, {
      shopId: loaded.shopId,
      config: loaded.config,
      newestSyncedAt: state.rows[0]?.newest_synced_at ?? null,
      oldestSyncedAt: state.rows[0]?.oldest_synced_at ?? null,
    });
    return {
      ok: true,
      message: `Rendelés-tükör frissítve: ${result.orderCount} rendelés.`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Rendelés-szinkron sikertelen";
    try {
      await markError(client, loaded.shopId, message);
    } catch {
      /* ignore */
    }
    return { ok: false, message };
  }
}
