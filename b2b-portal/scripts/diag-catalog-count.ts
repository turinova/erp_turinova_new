import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (process.env[k] == null) process.env[k] = v;
}

async function main() {
  const { query, withPlatformAdmin } = await import("../src/lib/db");
  const r = await withPlatformAdmin(async (client) => {
    const shop = await query<{
      id: string;
      catalog_status: string;
      catalog_product_count: number;
      catalog_synced_at: string | null;
    }>(
      client,
      `select id, catalog_status, catalog_product_count,
              catalog_synced_at::text as catalog_synced_at
       from shops
       order by updated_at desc nulls last
       limit 1`,
    );
    const s = shop.rows[0];
    const counts = await query<{
      active: string;
      inactive: string;
      total: string;
    }>(
      client,
      `select count(*) filter (where active)::text as active,
              count(*) filter (where not active)::text as inactive,
              count(*)::text as total
       from product_catalog where shop_id = $1`,
      [s.id],
    );
    const job = await query<{
      status: string;
      pages_done: number;
      pages_total: number | null;
      products_upserted: number;
      started_at: string | null;
      finished_at: string | null;
    }>(
      client,
      `select status, pages_done, pages_total, products_upserted,
              started_at::text, finished_at::text
       from sync_jobs where shop_id = $1
       order by created_at desc limit 1`,
      [s.id],
    );
    const sample = await query<{
      sku: string;
      name: string | null;
      synced_at: string;
    }>(
      client,
      `select sku, left(coalesce(name, ''), 50) as name, synced_at::text
       from product_catalog
       where shop_id = $1 and active
       order by sku_norm
       offset 50 limit 8`,
      [s.id],
    );
    const parents = await query<{ n: string }>(
      client,
      `select count(*)::text as n from product_catalog
       where shop_id = $1 and active
         and (upper(sku) like '%SZULO%' or upper(coalesce(name,'')) like '%SZÜLŐ%'
              or upper(coalesce(name,'')) like '%SZULO%')`,
      [s.id],
    );
    const emptyName = await query<{ n: string }>(
      client,
      `select count(*)::text as n from product_catalog
       where shop_id = $1 and active
         and (name is null or btrim(name) = '')`,
      [s.id],
    );
    const noPrice = await query<{ n: string }>(
      client,
      `select count(*)::text as n from product_catalog
       where shop_id = $1 and active and list_price_net is null`,
      [s.id],
    );
    return {
      shop: s,
      counts: counts.rows[0],
      job: job.rows[0],
      page2Sample: sample.rows,
      parentish: parents.rows[0]?.n,
      emptyName: emptyName.rows[0]?.n,
      noPrice: noPrice.rows[0]?.n,
    };
  });
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
