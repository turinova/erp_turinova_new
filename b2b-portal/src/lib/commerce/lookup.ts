import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { formatHuf, type ProductSearchHit } from "@/lib/shoprenter/api";

export type CatalogRow = {
  sku: string;
  sku_norm: string;
  external_product_id: string;
  name: string | null;
  model_number: string | null;
  gtin: string | null;
  min_qty: number;
  qty_step: number;
  list_price_net: string | null;
  active: boolean;
};

export function catalogIsSearchable(status: string | null | undefined): boolean {
  return (
    status === "ready" ||
    status === "blocked_limit" ||
    status === "degraded"
  );
}

function packLabel(minQty: number, qtyStep: number): string | undefined {
  if (qtyStep > 1) return `×${qtyStep}-osával`;
  if (minQty > 1) return `min. ${minQty} db`;
  return undefined;
}

function productIdFromExternal(id: string): number | null {
  if (/^\d+$/.test(id)) return Number(id);
  return null;
}

export function catalogRowToHit(row: CatalogRow): ProductSearchHit {
  const net =
    row.list_price_net != null && row.list_price_net !== ""
      ? Number(row.list_price_net)
      : NaN;
  const minQty = Math.max(1, row.min_qty || 1);
  const qtyStep = Math.max(1, row.qty_step || 1);
  return {
    sku: row.sku,
    productId: productIdFromExternal(row.external_product_id),
    name: row.name ?? undefined,
    modelNumber: row.model_number ?? undefined,
    gtin: row.gtin ?? undefined,
    priceNetFormatted: Number.isFinite(net) ? formatHuf(net) : undefined,
    minQty,
    qtyStep,
    packLabel: packLabel(minQty, qtyStep),
  };
}

export async function searchCatalog(
  client: PoolClient,
  shopId: string,
  rawQuery: string,
  limit = 8,
): Promise<CatalogRow[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const cap = Math.min(12, Math.max(1, Math.round(limit) || 8));
  const needle = q.toUpperCase();
  const namePat = q.length >= 3 ? `%${q}%` : null;

  const res = await query<CatalogRow>(
    client,
    `select sku, sku_norm, external_product_id, name, model_number, gtin,
            min_qty, qty_step, list_price_net::text, active
     from product_catalog
     where shop_id = $1
       and active
       and (
         sku_norm like $2 || '%'
         or model_norm like $2 || '%'
         or gtin_norm like $2 || '%'
         or ($3::text is not null and name ilike $3)
       )
     order by
       case
         when sku_norm = $2 then 0
         when sku_norm like $2 || '%' then 1
         when model_norm = $2 then 2
         when model_norm like $2 || '%' then 3
         when gtin_norm = $2 then 4
         when gtin_norm like $2 || '%' then 5
         else 6
       end,
       case when sku_norm like 'SZULO%' then 1 else 0 end,
       sku_norm
     limit $4`,
    [shopId, needle, namePat, cap],
  );
  return res.rows;
}

export async function lookupCatalogCode(
  client: PoolClient,
  shopId: string,
  rawCode: string,
): Promise<CatalogRow | null> {
  const code = rawCode.trim();
  if (!code) return null;
  const needle = code.toUpperCase();

  const exact = await query<CatalogRow>(
    client,
    `select sku, sku_norm, external_product_id, name, model_number, gtin,
            min_qty, qty_step, list_price_net::text, active
     from product_catalog
     where shop_id = $1 and active and (
       sku_norm = $2 or model_norm = $2 or gtin_norm = $2
     )
     order by
       case
         when sku_norm = $2 then 0
         when model_norm = $2 then 1
         else 2
       end,
       case when sku_norm like 'SZULO%' then 1 else 0 end,
       length(sku_norm),
       sku_norm
     limit 1`,
    [shopId, needle],
  );
  if (exact.rows[0]) return exact.rows[0];

  const prefix = await query<CatalogRow>(
    client,
    `select sku, sku_norm, external_product_id, name, model_number, gtin,
            min_qty, qty_step, list_price_net::text, active
     from product_catalog
     where shop_id = $1 and active and (
       sku_norm like $2 || '%'
       or model_norm like $2 || '%'
       or gtin_norm like $2 || '%'
     )
     order by
       case when sku_norm like $2 || '%' then 0 else 1 end,
       case when sku_norm like 'SZULO%' then 1 else 0 end,
       sku_norm
     limit 2`,
    [shopId, needle],
  );
  if (prefix.rows.length === 1) return prefix.rows[0];
  return null;
}

export async function loadShopCatalogStatus(
  client: PoolClient,
  shopId: string,
): Promise<{ catalogStatus: string; productCount: number }> {
  const res = await query<{
    catalog_status: string;
    catalog_product_count: number;
  }>(
    client,
    `select catalog_status, catalog_product_count from shops where id = $1`,
    [shopId],
  );
  const row = res.rows[0];
  return {
    catalogStatus: row?.catalog_status ?? "pending",
    productCount: row?.catalog_product_count ?? 0,
  };
}
