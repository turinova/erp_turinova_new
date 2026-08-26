/**
 * Local mirror of Shoprenter productSpecials (qty tiers).
 * /arak list badge uses Postgres; SR remains source of truth on panel open/save.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type MirroredVolumeTier = {
  minQty: number;
  priceNet: number;
  maxQty: number | null;
  srSpecialId: string | null;
};

export type TierCountInfo = {
  tierCount: number;
  /** Compact: "10+/50+" */
  tierSummary: string | null;
};

/**
 * Replace all mirrored tiers for one product × group.
 * Empty tiers = delete mirror rows (SR cleared).
 */
export async function replaceMirroredVolumeTiers(
  client: PoolClient,
  opts: {
    shopId: string;
    customerGroupOuterId: string;
    productInnerId: number;
    tiers: {
      minQty: number;
      priceNet: number;
      maxQty?: number | null;
      srSpecialId?: string | null;
    }[];
  },
): Promise<void> {
  const productInnerId = Math.round(opts.productInnerId);
  await query(
    client,
    `delete from partner_volume_tiers
     where shop_id = $1
       and customer_group_outer_id = $2
       and product_inner_id = $3`,
    [opts.shopId, opts.customerGroupOuterId, productInnerId],
  );

  const sorted = [...opts.tiers]
    .map((t) => ({
      minQty: Math.round(Number(t.minQty)),
      priceNet: Math.round(Number(t.priceNet)),
      maxQty:
        t.maxQty != null && Number(t.maxQty) > 0
          ? Math.round(Number(t.maxQty))
          : null,
      srSpecialId: t.srSpecialId ?? null,
    }))
    .filter(
      (t) =>
        Number.isFinite(t.minQty) &&
        t.minQty >= 1 &&
        Number.isFinite(t.priceNet) &&
        t.priceNet >= 0,
    )
    .sort((a, b) => a.minQty - b.minQty);

  for (const t of sorted) {
    await query(
      client,
      `insert into partner_volume_tiers (
         shop_id, customer_group_outer_id, product_inner_id,
         min_qty, price_net, max_qty, sr_special_id, synced_at
       ) values ($1, $2, $3, $4, $5, $6, $7, now())
       on conflict (shop_id, customer_group_outer_id, product_inner_id, min_qty)
       do update set
         price_net = excluded.price_net,
         max_qty = excluded.max_qty,
         sr_special_id = coalesce(excluded.sr_special_id, partner_volume_tiers.sr_special_id),
         synced_at = now()`,
      [
        opts.shopId,
        opts.customerGroupOuterId,
        productInnerId,
        t.minQty,
        t.priceNet,
        t.maxQty,
        t.srSpecialId,
      ],
    );
  }
}

export async function mapTierCountsForInners(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
  productInnerIds: number[],
): Promise<Map<number, TierCountInfo>> {
  const out = new Map<number, TierCountInfo>();
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
    min_qty: number;
    price_net: string;
  }>(
    client,
    `select product_inner_id, min_qty, price_net::text
     from partner_volume_tiers
     where shop_id = $1
       and customer_group_outer_id = $2
       and product_inner_id = any($3::int[])
     order by product_inner_id, min_qty`,
    [shopId, customerGroupOuterId, unique],
  );

  const byInner = new Map<number, { minQty: number; priceNet: number }[]>();
  for (const row of res.rows) {
    const id = Number(row.product_inner_id);
    const priceNet = Number(row.price_net);
    const minQty = Number(row.min_qty);
    if (!Number.isFinite(id) || !Number.isFinite(priceNet) || !Number.isFinite(minQty)) {
      continue;
    }
    const list = byInner.get(id) ?? [];
    list.push({ minQty: Math.round(minQty), priceNet: Math.round(priceNet) });
    byInner.set(id, list);
  }

  for (const [id, tiers] of byInner) {
    const summary =
      tiers.length === 0
        ? null
        : tiers
            .slice(0, 3)
            .map((t) => `${t.minQty}+`)
            .join("/") + (tiers.length > 3 ? "…" : "");
    out.set(id, {
      tierCount: tiers.length,
      tierSummary: summary,
    });
  }

  return out;
}

/** Distinct products with at least one mirrored volume tier for the group. */
export async function countMirroredTierProducts(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(distinct product_inner_id)::text as n
     from partner_volume_tiers
     where shop_id = $1
       and customer_group_outer_id = $2`,
    [shopId, customerGroupOuterId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

/** One query: outer group id → distinct product count with volume tiers. */
export async function mapTierProductCountsByGroup(
  client: PoolClient,
  shopId: string,
): Promise<Map<string, number>> {
  const res = await query<{
    customer_group_outer_id: string;
    n: string;
  }>(
    client,
    `select customer_group_outer_id, count(distinct product_inner_id)::text as n
     from partner_volume_tiers
     where shop_id = $1
     group by customer_group_outer_id`,
    [shopId],
  ).catch(() => ({ rows: [] as { customer_group_outer_id: string; n: string }[] }));

  const out = new Map<string, number>();
  for (const row of res.rows) {
    const id = (row.customer_group_outer_id || "").trim();
    const n = Number(row.n);
    if (id && Number.isFinite(n) && n > 0) out.set(id, n);
  }
  return out;
}

export async function listMirroredVolumeTiers(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
  productInnerId: number,
): Promise<MirroredVolumeTier[]> {
  const res = await query<{
    min_qty: number;
    price_net: string;
    max_qty: number | null;
    sr_special_id: string | null;
  }>(
    client,
    `select min_qty, price_net::text, max_qty, sr_special_id
     from partner_volume_tiers
     where shop_id = $1
       and customer_group_outer_id = $2
       and product_inner_id = $3
     order by min_qty`,
    [shopId, customerGroupOuterId, Math.round(productInnerId)],
  );
  return res.rows
    .map((r) => {
      const priceNet = Number(r.price_net);
      if (!Number.isFinite(priceNet)) return null;
      return {
        minQty: r.min_qty,
        priceNet: Math.round(priceNet),
        maxQty: r.max_qty,
        srSpecialId: r.sr_special_id,
      };
    })
    .filter((t): t is MirroredVolumeTier => t != null);
}

/** Distinct SR special ids mirrored for a group (best-effort SR cleanup). */
export async function listMirroredSpecialIdsForGroup(
  client: PoolClient,
  shopId: string,
  customerGroupOuterId: string,
): Promise<string[]> {
  const res = await query<{ sr_special_id: string }>(
    client,
    `select distinct sr_special_id
     from partner_volume_tiers
     where shop_id = $1
       and customer_group_outer_id = $2
       and sr_special_id is not null
       and length(trim(sr_special_id)) > 0`,
    [shopId, customerGroupOuterId],
  ).catch(() => ({ rows: [] as { sr_special_id: string }[] }));
  return res.rows.map((r) => r.sr_special_id.trim());
}
