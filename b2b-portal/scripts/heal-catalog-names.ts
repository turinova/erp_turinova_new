/**
 * Fill empty product_catalog.name from Shoprenter productDescriptions.
 * Usage: npx tsx scripts/heal-catalog-names.ts
 */
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
  const { decryptCredentials } = await import("../src/lib/crypto/credentials");
  const { configFromCredentials } = await import("../src/lib/shoprenter/ping");
  const { resolveProductDisplayName } = await import("../src/lib/shoprenter/api");

  const { config, shopId, rows } = await withPlatformAdmin(async (client) => {
    const shop = await query<{ id: string; shoprenter_shop_name: string }>(
      client,
      `select id, shoprenter_shop_name from shops
       order by updated_at desc nulls last limit 1`,
    );
    const s = shop.rows[0];
    const creds = await query<{
      auth_type: "oauth" | "basic_legacy";
      ciphertext: Buffer;
      iv: Buffer;
      key_version: number;
    }>(
      client,
      `select auth_type, ciphertext, iv, key_version
       from shop_credentials where shop_id = $1`,
      [s.id],
    );
    const c = creds.rows[0];
    const plain = decryptCredentials({
      ciphertext: Buffer.from(c.ciphertext),
      iv: Buffer.from(c.iv),
      key_version: c.key_version,
    });
    const missing = await query<{ sku: string; external_product_id: string }>(
      client,
      `select sku, external_product_id
       from product_catalog
       where shop_id = $1 and active
         and (name is null or btrim(name) = '')
         and external_product_id ~ '^[0-9]+$'
       order by sku_norm`,
      [s.id],
    );
    return {
      shopId: s.id,
      config: configFromCredentials(s.shoprenter_shop_name, plain),
      rows: missing.rows,
    };
  });

  console.log(`Nameless active products: ${rows.length}`);
  let ok = 0;
  let fail = 0;
  const concurrency = 3;
  let idx = 0;

  async function worker() {
    while (idx < rows.length) {
      const i = idx++;
      const row = rows[i];
      const inner = Number(row.external_product_id);
      try {
        const name = await resolveProductDisplayName(config, {
          productInnerId: inner,
        });
        if (name) {
          await withPlatformAdmin(async (client) => {
            await query(
              client,
              `update product_catalog
               set name = $3
               where shop_id = $1 and sku = $2
                 and (name is null or btrim(name) = '')`,
              [shopId, row.sku, name],
            );
          });
          ok++;
          if (row.sku === "AL250" || ok <= 3 || ok % 50 === 0) {
            console.log(`OK ${row.sku}: ${name.slice(0, 60)}`);
          }
        } else {
          fail++;
        }
      } catch {
        fail++;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()),
  );
  console.log(`Done. named=${ok} unresolved=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
