import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type B2bOrderLine = {
  sku: string;
  name?: string;
  qty: number;
  unit_net?: number | null;
  unit_gross?: number | null;
  vat_rate?: number | null;
};

export type InsertB2bOrderInput = {
  shopId: string;
  shopCustomerId?: string | null;
  emailSnapshot?: string | null;
  nameSnapshot?: string | null;
  srCustomerInnerId?: number | null;
  srGroupInnerId?: number | null;
  srGroupNameSnapshot?: string | null;
  currency?: string;
  netTotal?: number | null;
  grossTotal?: number | null;
  vatTotal?: number | null;
  lines: B2bOrderLine[];
  source?: "widget" | "manual" | "import";
  srOrderId?: string | null;
  meta?: Record<string, unknown>;
};

export async function insertB2bOrder(
  client: PoolClient,
  input: InsertB2bOrderInput,
): Promise<{ id: string }> {
  const lines = input.lines ?? [];
  const res = await query<{ id: string }>(
    client,
    `insert into b2b_orders (
       shop_id, shop_customer_id, email_snapshot, name_snapshot,
       sr_customer_inner_id, sr_group_inner_id, sr_group_name_snapshot,
       currency, net_total, gross_total, vat_total, line_count, lines,
       source, sr_order_id, meta
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16::jsonb
     )
     returning id`,
    [
      input.shopId,
      input.shopCustomerId ?? null,
      input.emailSnapshot ?? null,
      input.nameSnapshot ?? null,
      input.srCustomerInnerId ?? null,
      input.srGroupInnerId ?? null,
      input.srGroupNameSnapshot ?? null,
      input.currency ?? "HUF",
      input.netTotal ?? null,
      input.grossTotal ?? null,
      input.vatTotal ?? null,
      lines.length,
      JSON.stringify(lines),
      input.source ?? "widget",
      input.srOrderId ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return res.rows[0];
}
