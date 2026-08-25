import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import type {
  CategoryMeta,
  ProductCategoryLink,
} from "@/lib/shoprenter/api";
import type { CatalogProductDraft } from "./types";

export async function upsertCatalogCategories(
  client: PoolClient,
  shopId: string,
  categories: CategoryMeta[],
): Promise<number> {
  let n = 0;
  for (const c of categories) {
    const raw = (c.name || "").trim();
    const name =
      raw && !/^Kategória #\d+$/i.test(raw) ? raw : null;
    await query(
      client,
      `insert into catalog_categories (
         shop_id, category_inner_id, name, parent_inner_id, synced_at
       ) values ($1, $2, $3, $4, now())
       on conflict (shop_id, category_inner_id) do update set
         name = coalesce(
           nullif(btrim(excluded.name), ''),
           nullif(
             case
               when catalog_categories.name ~ '^Kategória #[0-9]+$'
               then null
               else catalog_categories.name
             end,
             ''
           )
         ),
         parent_inner_id = coalesce(
           excluded.parent_inner_id,
           catalog_categories.parent_inner_id
         ),
         synced_at = now()`,
      [shopId, c.innerId, name, c.parentInnerId],
    );
    n++;
  }
  return n;
}

export async function replaceProductCategories(
  client: PoolClient,
  shopId: string,
  productInnerId: number,
  categoryInnerIds: number[],
): Promise<void> {
  await query(
    client,
    `delete from product_catalog_categories
     where shop_id = $1 and product_inner_id = $2`,
    [shopId, productInnerId],
  );
  const unique = [
    ...new Set(
      categoryInnerIds.filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  for (const catId of unique) {
    await query(
      client,
      `insert into product_catalog_categories (
         shop_id, product_inner_id, category_inner_id, synced_at
       ) values ($1, $2, $3, now())
       on conflict do nothing`,
      [shopId, productInnerId, catId],
    );
  }
}

/** Shop összes termék↔kategória link (bulk SR sync / heal). */
export async function replaceShopProductCategoryLinks(
  client: PoolClient,
  shopId: string,
  links: ProductCategoryLink[],
): Promise<number> {
  const batchAt = new Date().toISOString();
  let n = 0;
  for (const link of links) {
    if (
      !Number.isFinite(link.productInnerId) ||
      link.productInnerId <= 0 ||
      !Number.isFinite(link.categoryInnerId) ||
      link.categoryInnerId <= 0
    ) {
      continue;
    }
    await query(
      client,
      `insert into product_catalog_categories (
         shop_id, product_inner_id, category_inner_id, synced_at
       ) values ($1, $2, $3, $4::timestamptz)
       on conflict (shop_id, product_inner_id, category_inner_id) do update set
         synced_at = excluded.synced_at`,
      [
        shopId,
        Math.round(link.productInnerId),
        Math.round(link.categoryInnerId),
        batchAt,
      ],
    );
    n++;
  }
  // SR-ből kikerült kapcsolatok törlése
  await query(
    client,
    `delete from product_catalog_categories
     where shop_id = $1 and synced_at < $2::timestamptz`,
    [shopId, batchAt],
  );
  return n;
}

export async function countProductCategoryLinks(
  client: PoolClient,
  shopId: string,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n from product_catalog_categories where shop_id = $1`,
    [shopId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function upsertCatalogPage(
  client: PoolClient,
  shopId: string,
  platform: string,
  drafts: CatalogProductDraft[],
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;
  for (const d of drafts) {
    try {
      await query(
        client,
        `insert into product_catalog (
           shop_id, platform, external_product_id, sku, model_number, gtin,
           name, image_url, manufacturer_inner_id, manufacturer_name,
           active, min_qty, qty_step, cost_net, list_price_net, synced_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now()
         )
         on conflict (shop_id, external_product_id) do update set
           platform = excluded.platform,
           sku = excluded.sku,
           model_number = excluded.model_number,
           gtin = excluded.gtin,
           name = coalesce(
             nullif(btrim(excluded.name), ''),
             product_catalog.name
           ),
           image_url = coalesce(
             nullif(btrim(excluded.image_url), ''),
             product_catalog.image_url
           ),
           manufacturer_inner_id = coalesce(
             excluded.manufacturer_inner_id,
             product_catalog.manufacturer_inner_id
           ),
           manufacturer_name = coalesce(
             nullif(btrim(excluded.manufacturer_name), ''),
             product_catalog.manufacturer_name
           ),
           active = excluded.active,
           min_qty = excluded.min_qty,
           qty_step = excluded.qty_step,
           cost_net = excluded.cost_net,
           list_price_net = excluded.list_price_net,
           synced_at = now()`,
        [
          shopId,
          platform,
          d.externalProductId,
          d.sku,
          d.modelNumber ?? null,
          d.gtin ?? null,
          d.name ?? null,
          d.imageUrl ?? null,
          d.manufacturerInnerId ?? null,
          d.manufacturerName ?? null,
          d.active,
          d.minQty,
          d.qtyStep,
          d.costNet ?? null,
          d.listPriceNet ?? null,
        ],
      );
      const productInner = Number(d.externalProductId);
      if (
        Number.isFinite(productInner) &&
        productInner > 0 &&
        d.categoryInnerIds
      ) {
        await replaceProductCategories(
          client,
          shopId,
          Math.round(productInner),
          d.categoryInnerIds,
        );
      }
      upserted++;
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      // Duplicate sku_norm from a different external id — skip, don't abort the job
      if (code === "23505") {
        skipped++;
        // Touch synced_at so a full-sync stale pass does not false-deactivate
        // a row we attempted to refresh (conflict on another unique key).
        await query(
          client,
          `update product_catalog
           set synced_at = now(),
               active = $3
           where shop_id = $1 and external_product_id = $2`,
          [shopId, d.externalProductId, d.active],
        ).catch(() => undefined);
        continue;
      }
      throw err;
    }
  }
  return { upserted, skipped };
}

/**
 * Full sync after last page: products not touched this run stay with old
 * synced_at → mark inactive (deleted / dropped from Shoprenter listing).
 */
export async function deactivateStaleCatalogProducts(
  client: PoolClient,
  shopId: string,
  syncedBefore: Date | string,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `with u as (
       update product_catalog
       set active = false,
           updated_at = now()
       where shop_id = $1
         and active
         and synced_at < $2::timestamptz
       returning 1
     )
     select count(*)::text as n from u`,
    [shopId, syncedBefore],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function countOrgActiveSkus(
  client: PoolClient,
  organizationId: string,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n
     from product_catalog pc
     join shops s on s.id = pc.shop_id
     where s.organization_id = $1
       and s.purged_at is null
       and pc.active`,
    [organizationId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function countShopCatalog(
  client: PoolClient,
  shopId: string,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n from product_catalog where shop_id = $1 and active`,
    [shopId],
  );
  return Number(res.rows[0]?.n ?? 0);
}
