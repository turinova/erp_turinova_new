/**
 * Customer 360 — DB-first olvasás shop_order_facts / shop_customers tükrökből.
 * Hot path: 0 Shoprenter hívás, ha a tükör elérhető.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import {
  formatHuf,
  parseShoprenterOrderTime,
  type CustomerOrderSummary,
} from "@/lib/shoprenter";

export type ShopCustomerFingerprint = {
  id: string;
  sr_customer_inner_id: number;
  sr_customer_id: string | null;
  email: string | null;
  name_snapshot: string | null;
  phone_snapshot: string | null;
  tax_number_snapshot: string | null;
  company_snapshot: string | null;
  sr_group_inner_id: number | null;
  sr_group_name_snapshot: string | null;
  sr_status: string;
  approved: boolean | null;
  date_created_sr: string | null;
  last_synced_at: string | null;
  skip_auto_group_move: boolean;
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatOrderDate(iso: string): string {
  const t = parseShoprenterOrderTime(iso);
  if (!t) return "—";
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(t));
  } catch {
    return iso.slice(0, 10);
  }
}

function toIso(raw: Date | string | null | undefined): string {
  if (raw == null) return "";
  if (raw instanceof Date) return raw.toISOString();
  const s = String(raw).trim();
  if (!s) return "";
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

/** CUSTOMER_DETAIL_USE_FACTS=0 kikapcsolja; különben auto, ha a tábla létezik. */
export function customerDetailUseFactsEnabled(): boolean {
  const raw = (process.env.CUSTOMER_DETAIL_USE_FACTS || "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export async function orderFactsTableExists(
  client: PoolClient,
): Promise<boolean> {
  const res = await query<{ reg: string | null }>(
    client,
    `select to_regclass('public.shop_order_facts')::text as reg`,
  );
  return Boolean(res.rows[0]?.reg);
}

export async function getShopCustomerFingerprint(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
): Promise<ShopCustomerFingerprint | null> {
  try {
    const res = await query<ShopCustomerFingerprint>(
      client,
      `select id, sr_customer_inner_id, sr_customer_id, email, name_snapshot,
              phone_snapshot, tax_number_snapshot, company_snapshot,
              sr_group_inner_id, sr_group_name_snapshot, sr_status,
              approved, date_created_sr::text as date_created_sr,
              last_synced_at::text as last_synced_at,
              coalesce(skip_auto_group_move, false) as skip_auto_group_move
       from shop_customers
       where shop_id = $1 and sr_customer_inner_id = $2`,
      [shopId, srCustomerInnerId],
    );
    return res.rows[0] ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/company_snapshot|approved|date_created_sr/i.test(msg)) throw err;
  }

  const res = await query<{
    id: string;
    sr_customer_inner_id: number;
    sr_customer_id: string | null;
    email: string | null;
    name_snapshot: string | null;
    phone_snapshot: string | null;
    tax_number_snapshot: string | null;
    sr_group_inner_id: number | null;
    sr_group_name_snapshot: string | null;
    sr_status: string;
    last_synced_at: string | null;
    skip_auto_group_move: boolean;
  }>(
    client,
    `select id, sr_customer_inner_id, sr_customer_id, email, name_snapshot,
            phone_snapshot, tax_number_snapshot,
            sr_group_inner_id, sr_group_name_snapshot, sr_status,
            last_synced_at::text as last_synced_at,
            coalesce(skip_auto_group_move, false) as skip_auto_group_move
     from shop_customers
     where shop_id = $1 and sr_customer_inner_id = $2`,
    [shopId, srCustomerInnerId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    company_snapshot: null,
    approved: null,
    date_created_sr: null,
  };
}

/** Fingerprint „friss”, ha last_synced_at a maxAge-n belül van. */
export function fingerprintIsFresh(
  fp: ShopCustomerFingerprint | null,
  maxAgeMs = 6 * 60 * 60 * 1000,
): boolean {
  if (!fp?.last_synced_at) return false;
  const t = Date.parse(fp.last_synced_at);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= maxAgeMs;
}

type FactOrderRow = {
  sr_order_id: string;
  sr_order_inner_id: string | null;
  date_created: Date | string;
  status_name: string | null;
  total_gross: string | number;
  shipping_gross: string | number;
  discount_gross: string | number;
  email: string | null;
  customer_name: string | null;
  line_count: string | number | null;
};

export async function listCustomerOrdersFromFacts(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  opts?: { limit?: number },
): Promise<{ orders: CustomerOrderSummary[]; pageCount: number }> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const res = await query<FactOrderRow>(
    client,
    `select f.sr_order_id, f.sr_order_inner_id, f.date_created, f.status_name,
            f.total_gross, f.shipping_gross, f.discount_gross, f.email,
            f.customer_name,
            (select count(*)::int from shop_order_line_facts l
              where l.order_fact_id = f.id and coalesce(l.is_fee_or_shipping, false) = false
            ) as line_count
     from shop_order_facts f
     where f.shop_id = $1 and f.sr_customer_inner_id = $2
     order by f.date_created desc
     limit $3`,
    [shopId, srCustomerInnerId, limit],
  );

  const orders: CustomerOrderSummary[] = res.rows.map((row) => {
    const dateCreated = toIso(row.date_created);
    const total = Math.round(num(row.total_gross));
    const shipping = Math.round(num(row.shipping_gross));
    const discount = Math.round(num(row.discount_gross));
    const innerId =
      (row.sr_order_inner_id && String(row.sr_order_inner_id)) ||
      row.sr_order_id;
    return {
      id: row.sr_order_id,
      innerId,
      dateCreated,
      dateLabel: dateCreated ? formatOrderDate(dateCreated) : "—",
      total,
      totalFormatted: formatHuf(total),
      totalGross: total,
      shippingGross: shipping || undefined,
      discountGross: discount || undefined,
      status: row.status_name?.trim() || "—",
      itemCount: Math.max(0, Math.round(num(row.line_count))),
      email: row.email,
      customerInnerId: srCustomerInnerId,
      customerName: row.customer_name,
    };
  });

  return { orders, pageCount: 1 };
}

export async function countCustomerOrderFacts(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n from shop_order_facts
     where shop_id = $1 and sr_customer_inner_id = $2`,
    [shopId, srCustomerInnerId],
  );
  return Number(res.rows[0]?.n || 0) || 0;
}

/** Finance / products tab: összes fact rendelés a tartományhoz. */
export async function listAllCustomerOrdersFromFacts(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  opts?: { sinceMs?: number },
): Promise<CustomerOrderSummary[]> {
  const params: unknown[] = [shopId, srCustomerInnerId];
  let sinceClause = "";
  if (opts?.sinceMs != null && Number.isFinite(opts.sinceMs)) {
    params.push(new Date(opts.sinceMs).toISOString());
    sinceClause = ` and f.date_created >= $3::timestamptz`;
  }
  const res = await query<FactOrderRow>(
    client,
    `select f.sr_order_id, f.sr_order_inner_id, f.date_created, f.status_name,
            f.total_gross, f.shipping_gross, f.discount_gross, f.email,
            f.customer_name,
            (select count(*)::int from shop_order_line_facts l
              where l.order_fact_id = f.id and coalesce(l.is_fee_or_shipping, false) = false
            ) as line_count
     from shop_order_facts f
     where f.shop_id = $1 and f.sr_customer_inner_id = $2${sinceClause}
     order by f.date_created desc
     limit 500`,
    params,
  );

  return res.rows.map((row) => {
    const dateCreated = toIso(row.date_created);
    const total = Math.round(num(row.total_gross));
    return {
      id: row.sr_order_id,
      innerId:
        (row.sr_order_inner_id && String(row.sr_order_inner_id)) ||
        row.sr_order_id,
      dateCreated,
      dateLabel: dateCreated ? formatOrderDate(dateCreated) : "—",
      total,
      totalFormatted: formatHuf(total),
      totalGross: total,
      shippingGross: Math.round(num(row.shipping_gross)) || undefined,
      discountGross: Math.round(num(row.discount_gross)) || undefined,
      status: row.status_name?.trim() || "—",
      itemCount: Math.max(0, Math.round(num(row.line_count))),
      email: row.email,
      customerInnerId: srCustomerInnerId,
      customerName: row.customer_name,
    };
  });
}

export type LineFactAggRow = {
  sku: string | null;
  sku_norm: string | null;
  model_number: string | null;
  name: string | null;
  quantity: string | number;
  line_gross: string | number;
  line_net: string | number | null;
  date_created: Date | string;
  sr_order_id: string;
};

export async function listCustomerLineFacts(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
): Promise<LineFactAggRow[]> {
  try {
    const res = await query<LineFactAggRow>(
      client,
      `select l.sku, l.sku_norm, l.model_number, l.name, l.quantity,
              l.line_gross, l.line_net, f.date_created, f.sr_order_id
       from shop_order_line_facts l
       join shop_order_facts f on f.id = l.order_fact_id
       where f.shop_id = $1 and f.sr_customer_inner_id = $2
         and coalesce(l.is_fee_or_shipping, false) = false
       order by f.date_created desc
       limit 2000`,
      [shopId, srCustomerInnerId],
    );
    return res.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/shop_order_line_facts|does not exist/i.test(msg)) return [];
    throw err;
  }
}
