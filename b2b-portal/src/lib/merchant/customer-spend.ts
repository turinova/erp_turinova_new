/**
 * Lifetime spend from synced shop_order_facts (gross).
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export async function mapLifetimeSpendByInnerId(
  client: PoolClient,
  shopId: string,
  innerIds: number[],
): Promise<Map<number, number>> {
  const ids = [...new Set(innerIds.filter((n) => Number.isFinite(n) && n > 0))];
  const out = new Map<number, number>();
  if (!ids.length) return out;

  try {
    const res = await query<{
      sr_customer_inner_id: number;
      spent: string | number;
    }>(
      client,
      `select sr_customer_inner_id,
              coalesce(sum(total_gross), 0) as spent
         from shop_order_facts
        where shop_id = $1
          and sr_customer_inner_id = any($2::int[])
        group by sr_customer_inner_id`,
      [shopId, ids],
    );
    for (const row of res.rows) {
      const spent = Math.round(Number(row.spent) || 0);
      out.set(row.sr_customer_inner_id, spent);
    }
  } catch (err) {
    // Table may be missing before migration 029 — treat as zero.
    console.warn("[customer-spend] mapLifetimeSpendByInnerId", err);
  }
  return out;
}

/** Local fingerprint search — complements Shoprenter (no name filter). */
export async function searchShopCustomerInnerIds(
  client: PoolClient,
  shopId: string,
  q: string,
  limit = 50,
): Promise<number[]> {
  const needle = q.trim();
  if (!needle) return [];
  try {
    const res = await query<{ sr_customer_inner_id: number }>(
      client,
      `select sr_customer_inner_id
         from shop_customers
        where shop_id = $1
          and sr_status = 'active'
          and (
            email ilike '%' || $2 || '%'
            or coalesce(name_snapshot, '') ilike '%' || $2 || '%'
          )
        order by last_seen_at desc nulls last
        limit $3`,
      [shopId, needle, Math.min(50, Math.max(1, limit))],
    );
    return res.rows.map((r) => r.sr_customer_inner_id);
  } catch (err) {
    console.warn("[customer-spend] searchShopCustomerInnerIds", err);
    return [];
  }
}
