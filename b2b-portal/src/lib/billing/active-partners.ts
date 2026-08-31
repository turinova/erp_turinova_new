import type { PoolClient } from "pg";
import { SOFT_PARTNER_LIMIT, SOFT_SKU_LIMIT } from "@/lib/billing/plans";
import { query } from "@/lib/db";

/** Active Partner = distinct widget orderers in the calendar month (D3). */

export async function countActivePartnersMonth(
  client: PoolClient,
  organizationId: string,
  month: Date = new Date(),
): Promise<number> {
  const res = await query<{ count_active_partners_month: number }>(
    client,
    `select public.count_active_partners_month($1::uuid, $2::timestamptz) as count_active_partners_month`,
    [organizationId, month.toISOString()],
  );
  return Number(res.rows[0]?.count_active_partners_month ?? 0);
}

export async function countActivePartnersMonthByShop(
  client: PoolClient,
  organizationId: string,
  month: Date = new Date(),
): Promise<Array<{ shopId: string; activePartners: number }>> {
  const res = await query<{ shop_id: string; active_partners: number }>(
    client,
    `select shop_id, active_partners
     from public.count_active_partners_month_by_shop($1::uuid, $2::timestamptz)`,
    [organizationId, month.toISOString()],
  );
  return res.rows.map((r) => ({
    shopId: r.shop_id,
    activePartners: Number(r.active_partners ?? 0),
  }));
}

export async function effectivePartnerLimit(
  client: PoolClient,
  organizationId: string,
): Promise<number> {
  const res = await query<{ effective_partner_limit: number }>(
    client,
    `select public.effective_partner_limit($1::uuid) as effective_partner_limit`,
    [organizationId],
  );
  return Number(res.rows[0]?.effective_partner_limit ?? SOFT_PARTNER_LIMIT);
}

export async function effectiveSkuLimit(
  client: PoolClient,
  organizationId: string,
): Promise<number> {
  const res = await query<{ effective_sku_limit: number }>(
    client,
    `select public.effective_sku_limit($1::uuid) as effective_sku_limit`,
    [organizationId],
  );
  return Number(res.rows[0]?.effective_sku_limit ?? SOFT_SKU_LIMIT);
}
