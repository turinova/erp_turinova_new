import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import type { CatalogProductDraft } from "./types";

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
           name, active, min_qty, qty_step, cost_net, list_price_net, synced_at
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now()
         )
         on conflict (shop_id, external_product_id) do update set
           platform = excluded.platform,
           sku = excluded.sku,
           model_number = excluded.model_number,
           gtin = excluded.gtin,
           name = excluded.name,
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
          d.active,
          d.minQty,
          d.qtyStep,
          d.costNet ?? null,
          d.listPriceNet ?? null,
        ],
      );
      upserted++;
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      // Duplicate sku_norm from a different external id — skip, don't abort the job
      if (code === "23505") {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  return { upserted, skipped };
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
    `select count(*)::text as n from product_catalog where shop_id = $1`,
    [shopId],
  );
  return Number(res.rows[0]?.n ?? 0);
}
