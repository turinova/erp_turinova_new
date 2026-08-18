import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export const ERP_QUALIFIED_MIN_HITS = 3;

export type ErpSignal = {
  id: "partners" | "orders" | "sku" | "gmv";
  label: string;
  threshold: string;
  value: string;
  hit: boolean;
};

export type ErpQualified = {
  qualified: boolean;
  hits: number;
  signals: ErpSignal[];
};

function fmt(n: number): string {
  return n.toLocaleString("hu-HU");
}

export function evaluateErpQualified(input: {
  activePartnersMonth: number;
  widgetOrdersMonth: number;
  skuCount: number;
  widgetGrossMonth: number;
}): ErpQualified {
  const signals: ErpSignal[] = [
    {
      id: "partners",
      label: "Aktív vevő / hó",
      threshold: "> 40",
      value: fmt(input.activePartnersMonth),
      hit: input.activePartnersMonth > 40,
    },
    {
      id: "orders",
      label: "Widget-rendelés / hó",
      threshold: "> 150",
      value: fmt(input.widgetOrdersMonth),
      hit: input.widgetOrdersMonth > 150,
    },
    {
      id: "sku",
      label: "Katalógus SKU",
      threshold: "> 8 000",
      value: fmt(input.skuCount),
      hit: input.skuCount > 8_000,
    },
    {
      id: "gmv",
      label: "Widget érték / hó",
      threshold: "> 8 M Ft",
      value: `${fmt(Math.round(input.widgetGrossMonth))} Ft`,
      hit: input.widgetGrossMonth > 8_000_000,
    },
  ];
  const hits = signals.filter((s) => s.hit).length;
  return { qualified: hits >= ERP_QUALIFIED_MIN_HITS, hits, signals };
}

export async function loadErpQualified(
  client: PoolClient,
  organizationId: string,
): Promise<ErpQualified> {
  const res = await query<{
    partners: number;
    orders: number;
    sku: number;
    gmv: number;
  }>(
    client,
    `select
       public.count_active_partners_month($1::uuid) as partners,
       (
         select count(*)::int
         from b2b_orders o
         join shops s on s.id = o.shop_id
         where s.organization_id = $1
           and s.purged_at is null
           and o.source = 'widget'
           and o.status in ('recorded', 'linked')
           and o.created_at >= date_trunc('month', now())
       ) as orders,
       coalesce((
         select count(*)::int
         from product_catalog pc
         join shops s on s.id = pc.shop_id
         where s.organization_id = $1
           and s.purged_at is null
           and pc.active
       ), 0) as sku,
       coalesce((
         select sum(coalesce(o.gross_total, o.net_total))
         from b2b_orders o
         join shops s on s.id = o.shop_id
         where s.organization_id = $1
           and s.purged_at is null
           and o.source = 'widget'
           and o.status in ('recorded', 'linked')
           and o.created_at >= date_trunc('month', now())
       ), 0) as gmv`,
    [organizationId],
  );
  const row = res.rows[0];
  return evaluateErpQualified({
    activePartnersMonth: Number(row?.partners ?? 0),
    widgetOrdersMonth: Number(row?.orders ?? 0),
    skuCount: Number(row?.sku ?? 0),
    widgetGrossMonth: Number(row?.gmv ?? 0),
  });
}
