import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { formatHuf, type ProductSearchHit } from "@/lib/shoprenter/api";

export type CatalogRow = {
  sku: string;
  sku_norm: string;
  external_product_id: string;
  name: string | null;
  image_url: string | null;
  model_number: string | null;
  gtin: string | null;
  manufacturer_inner_id?: number | null;
  manufacturer_name?: string | null;
  min_qty: number;
  qty_step: number;
  list_price_net: string | null;
  cost_net?: string | null;
  active: boolean;
};

export type CatalogManufacturer = {
  innerId: number;
  name: string;
  productCount: number;
};

export type CatalogCategory = {
  innerId: number;
  name: string;
  parentInnerId: number | null;
  /** Megjelenítés: „Szülő › Gyerek” */
  label: string;
  productCount: number;
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

/** Lapozott katalógus az Árak szerkesztőhöz. */
export async function listCatalogPage(
  client: PoolClient,
  shopId: string,
  opts?: {
    page?: number;
    limit?: number;
    q?: string;
    manufacturerInnerId?: number | null;
    categoryInnerId?: number | null;
    /** Szülő kategória → gyerekek is (default true). */
    includeDescendants?: boolean;
    /** Csak fix csoportáras termékek (JOIN partner_group_prices). */
    ownOnly?: boolean;
    /** Csak mennyiségi sávos termékek (EXISTS partner_volume_tiers). */
    tiersOnly?: boolean;
    customerGroupOuterId?: string | null;
  },
): Promise<{ rows: CatalogRow[]; pageCount: number; total: number }> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const page = Math.max(0, opts?.page ?? 0);
  const q = (opts?.q ?? "").trim();
  const offset = page * limit;
  const mfrId =
    opts?.manufacturerInnerId != null &&
    Number.isFinite(opts.manufacturerInnerId) &&
    opts.manufacturerInnerId > 0
      ? Math.round(opts.manufacturerInnerId)
      : null;
  const catId =
    opts?.categoryInnerId != null &&
    Number.isFinite(opts.categoryInnerId) &&
    opts.categoryInnerId > 0
      ? Math.round(opts.categoryInnerId)
      : null;
  const includeDescendants = opts?.includeDescendants !== false;
  const groupOuter = (opts?.customerGroupOuterId ?? "").trim();
  const ownOnly = Boolean(opts?.ownOnly && groupOuter);
  const tiersOnly = Boolean(opts?.tiersOnly && groupOuter);

  let categoryIds: number[] | null = null;
  if (catId != null) {
    categoryIds = includeDescendants
      ? await listCategoryDescendantIds(client, shopId, catId)
      : [catId];
  }

  const whereParts = ["pc.shop_id = $1", "pc.active"];
  const params: unknown[] = [shopId];
  let p = 2;

  if (ownOnly) {
    whereParts.push(`pgp.customer_group_outer_id = $${p}`);
    params.push(groupOuter);
    p++;
  }

  if (tiersOnly) {
    whereParts.push(`exists (
      select 1 from partner_volume_tiers pvt
      where pvt.shop_id = pc.shop_id
        and pvt.customer_group_outer_id = $${p}
        and pvt.product_inner_id::text = pc.external_product_id
    )`);
    params.push(groupOuter);
    p++;
  }

  if (mfrId != null) {
    whereParts.push(`pc.manufacturer_inner_id = $${p}`);
    params.push(mfrId);
    p++;
  }

  if (categoryIds != null && categoryIds.length > 0) {
    whereParts.push(`exists (
      select 1 from product_catalog_categories pcc
      where pcc.shop_id = pc.shop_id
        and pcc.product_inner_id::text = pc.external_product_id
        and pcc.category_inner_id = any($${p}::int[])
    )`);
    params.push(categoryIds);
    p++;
  }

  if (q.length >= 2) {
    const needle = q.toUpperCase();
    const namePat = q.length >= 3 ? `%${q}%` : null;
    whereParts.push(`(
      pc.sku_norm like $${p} || '%'
      or pc.model_norm like $${p} || '%'
      or pc.gtin_norm like $${p} || '%'
      or ($${p + 1}::text is not null and pc.name ilike $${p + 1})
    )`);
    params.push(needle, namePat);
    p += 2;
  }

  const whereSql = whereParts.join(" and ");
  const fromSql = ownOnly
    ? `product_catalog pc
       inner join partner_group_prices pgp
         on pgp.shop_id = pc.shop_id
        and pc.external_product_id = pgp.product_inner_id::text`
    : `product_catalog pc`;

  const countRes = await query<{ n: string }>(
    client,
    `select count(*)::text as n from ${fromSql} where ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0]?.n ?? 0);

  const res = await query<CatalogRow>(
    client,
    `select pc.sku, pc.sku_norm, pc.external_product_id, pc.name, pc.image_url,
            pc.model_number, pc.gtin,
            pc.manufacturer_inner_id, pc.manufacturer_name,
            pc.min_qty, pc.qty_step, pc.list_price_net::text, pc.cost_net::text, pc.active
     from ${fromSql}
     where ${whereSql}
     order by pc.sku_norm
     limit $${p} offset $${p + 1}`,
    [...params, limit, offset],
  );
  return {
    rows: res.rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / limit) || 1),
  };
}

/** Szülő + összes leszármazott category_inner_id. */
export async function listCategoryDescendantIds(
  client: PoolClient,
  shopId: string,
  rootInnerId: number,
): Promise<number[]> {
  const res = await query<{ category_inner_id: number }>(
    client,
    `with recursive tree as (
       select category_inner_id
       from catalog_categories
       where shop_id = $1 and category_inner_id = $2
       union
       select c.category_inner_id
       from catalog_categories c
       inner join tree t on c.parent_inner_id = t.category_inner_id
       where c.shop_id = $1
     )
     select category_inner_id from tree`,
    [shopId, rootInnerId],
  );
  const ids = res.rows.map((r) => r.category_inner_id);
  return ids.length ? ids : [rootInnerId];
}

/** Márkák a bolt katalógusából (szűrő dropdown). */
export async function listCatalogManufacturers(
  client: PoolClient,
  shopId: string,
): Promise<CatalogManufacturer[]> {
  const res = await query<{
    manufacturer_inner_id: number;
    manufacturer_name: string | null;
    n: string;
  }>(
    client,
    `select manufacturer_inner_id,
            max(manufacturer_name) as manufacturer_name,
            count(*)::text as n
     from product_catalog
     where shop_id = $1
       and active
       and manufacturer_inner_id is not null
     group by manufacturer_inner_id
     order by max(manufacturer_name) nulls last, manufacturer_inner_id`,
    [shopId],
  );
  return res.rows.map((r) => ({
    innerId: r.manufacturer_inner_id,
    name: (r.manufacturer_name || "").trim() || `Gyártó #${r.manufacturer_inner_id}`,
    productCount: Number(r.n) || 0,
  }));
}

/** Összes termék inner id egy gyártóra (bulk hatókör). */
export async function listProductInnersByManufacturer(
  client: PoolClient,
  shopId: string,
  manufacturerInnerId: number,
  limit = 200,
): Promise<number[]> {
  const cap = Math.min(500, Math.max(1, limit));
  const res = await query<{ external_product_id: string }>(
    client,
    `select external_product_id
     from product_catalog
     where shop_id = $1
       and active
       and manufacturer_inner_id = $2
       and external_product_id ~ '^[0-9]+$'
     order by sku_norm
     limit $3`,
    [shopId, manufacturerInnerId, cap],
  );
  return res.rows
    .map((r) => Number(r.external_product_id))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Kategóriák dropdownhoz (label + direkt termék count). */
export async function listCatalogCategories(
  client: PoolClient,
  shopId: string,
): Promise<CatalogCategory[]> {
  const res = await query<{
    category_inner_id: number;
    name: string | null;
    parent_inner_id: number | null;
    parent_name: string | null;
    n: string;
  }>(
    client,
    `select c.category_inner_id,
            c.name,
            c.parent_inner_id,
            p.name as parent_name,
            coalesce(cnt.n, '0') as n
     from catalog_categories c
     left join catalog_categories p
       on p.shop_id = c.shop_id
      and p.category_inner_id = c.parent_inner_id
     left join lateral (
       select count(*)::text as n
       from product_catalog_categories pcc
       inner join product_catalog pc
         on pc.shop_id = pcc.shop_id
        and pc.external_product_id = pcc.product_inner_id::text
        and pc.active
       where pcc.shop_id = c.shop_id
         and pcc.category_inner_id = c.category_inner_id
     ) cnt on true
     where c.shop_id = $1
     order by coalesce(p.name, c.name) nulls last, c.name nulls last, c.category_inner_id`,
    [shopId],
  );
  return res.rows.map((r) => {
    const name = (r.name || "").trim() || `Kategória #${r.category_inner_id}`;
    const parent = (r.parent_name || "").trim();
    return {
      innerId: r.category_inner_id,
      name,
      parentInnerId: r.parent_inner_id,
      label: parent ? `${parent} › ${name}` : name,
      productCount: Number(r.n) || 0,
    };
  });
}

/** Termék inner id-k kategóriára (+ leszármazottak). */
export async function listProductInnersByCategory(
  client: PoolClient,
  shopId: string,
  categoryInnerId: number,
  limit = 200,
  includeDescendants = true,
): Promise<number[]> {
  const cap = Math.min(500, Math.max(1, limit));
  const catIds = includeDescendants
    ? await listCategoryDescendantIds(client, shopId, categoryInnerId)
    : [categoryInnerId];
  const res = await query<{ external_product_id: string }>(
    client,
    `select distinct pc.external_product_id
     from product_catalog pc
     inner join product_catalog_categories pcc
       on pcc.shop_id = pc.shop_id
      and pcc.product_inner_id::text = pc.external_product_id
     where pc.shop_id = $1
       and pc.active
       and pcc.category_inner_id = any($2::int[])
       and pc.external_product_id ~ '^[0-9]+$'
     order by pc.external_product_id
     limit $3`,
    [shopId, catIds, cap],
  );
  return res.rows
    .map((r) => Number(r.external_product_id))
    .filter((n) => Number.isFinite(n) && n > 0);
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

export async function lookupCatalogCodes(
  client: PoolClient,
  shopId: string,
  codes: string[],
): Promise<Map<string, CatalogRow>> {
  const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
  const out = new Map<string, CatalogRow>();
  if (!unique.length) return out;

  const needles = unique.map((c) => c.toUpperCase());
  const exact = await query<CatalogRow & { hit: string }>(
    client,
    `select distinct on (x.hit)
            p.sku, p.sku_norm, p.external_product_id, p.name, p.model_number, p.gtin,
            p.min_qty, p.qty_step, p.list_price_net::text, p.active,
            x.hit
     from unnest($2::text[]) as x(hit)
     join product_catalog p
       on p.shop_id = $1 and p.active
      and (p.sku_norm = x.hit or p.model_norm = x.hit or p.gtin_norm = x.hit)
     order by x.hit,
       case
         when p.sku_norm = x.hit then 0
         when p.model_norm = x.hit then 1
         else 2
       end,
       case when p.sku_norm like 'SZULO%' then 1 else 0 end,
       length(p.sku_norm)`,
    [shopId, needles],
  );
  const byNeedle = new Map<string, CatalogRow>();
  for (const row of exact.rows) {
    byNeedle.set(row.hit, row);
  }
  for (const code of unique) {
    const row = byNeedle.get(code.toUpperCase());
    if (row) out.set(code, row);
  }

  const missing = unique.filter((c) => !out.has(c));
  for (const code of missing) {
    const row = await lookupCatalogCode(client, shopId, code);
    if (row) out.set(code, row);
  }
  return out;
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
