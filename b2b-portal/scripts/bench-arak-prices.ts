/**
 * Bench: /arak prices read path (Postgres mirror vs legacy N× SR find estimate).
 *
 * Usage: cd b2b-portal && npx tsx scripts/bench-arak-prices.ts
 * Needs DATABASE_URL (+ optional shop with credentials for live SR sync timing).
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();
async function main() {
  const { getPool, query, withPlatformAdmin } = await import("../src/lib/db");
  const {
    ensureGroupPriceMirror,
    mapMirroredPricesForInners,
    countMirroredGroupPrices,
    isMirrorFresh,
    getGroupPriceSyncMeta,
  } = await import("../src/lib/commerce/group-price-mirror");
  const { listCatalogPage } = await import("../src/lib/commerce/lookup");
  const { decryptCredentials } = await import("../src/lib/crypto/credentials");
  const { configFromCredentials } = await import("../src/lib/shoprenter/ping");
  const { listCustomerGroups } = await import("../src/lib/shoprenter/customers");

  getPool();

  type ShopRow = {
    id: string;
    organization_id: string;
    shoprenter_shop_name: string;
  };

  const shop = await withPlatformAdmin(async (client) => {
    const res = await query<ShopRow>(
      client,
      `select s.id, s.organization_id, s.shoprenter_shop_name
       from shops s
       join shop_credentials c on c.shop_id = s.id
       where s.purged_at is null
       order by s.updated_at desc nulls last
       limit 1`,
    );
    return res.rows[0] ?? null;
  });

  if (!shop) {
    console.error("No shop with credentials found.");
    process.exit(1);
  }

  console.log("Shop:", shop.shoprenter_shop_name, shop.id);

  const tableOk = await withPlatformAdmin(async (client) => {
    const res = await query<{ ok: boolean }>(
      client,
      `select to_regclass('public.partner_group_prices') is not null as ok`,
    );
    return Boolean(res.rows[0]?.ok);
  });
  if (!tableOk) {
    console.error(
      "Missing public.partner_group_prices — run sql/022_partner_group_prices.sql",
    );
    process.exit(1);
  }

  const catalogStats = await withPlatformAdmin(async (client) => {
    const t0 = Date.now();
    const page = await listCatalogPage(client, shop.id, {
      page: 0,
      limit: 50,
    });
    const catalogMs = Date.now() - t0;
    const countRes = await query<{ n: string }>(
      client,
      `select count(*)::text as n from product_catalog where shop_id = $1 and active`,
      [shop.id],
    );
    return {
      catalogMs,
      pageRows: page.rows.length,
      totalActive: Number(countRes.rows[0]?.n ?? 0),
      page,
    };
  });

  console.log("\n=== Catalog SQL (limit 50) ===");
  console.log({
    activeSkus: catalogStats.totalActive,
    pageRows: catalogStats.pageRows,
    listCatalogPageMs: catalogStats.catalogMs,
  });

  const config = await withPlatformAdmin(async (client) => {
    const res = await query<{
      auth_type: "oauth" | "basic_legacy";
      ciphertext: Buffer;
      iv: Buffer;
      key_version: number;
    }>(
      client,
      `select auth_type, ciphertext, iv, key_version
       from shop_credentials where shop_id = $1`,
      [shop.id],
    );
    const row = res.rows[0];
    if (!row) return null;
    const plain = decryptCredentials({
      ciphertext: Buffer.from(row.ciphertext),
      iv: Buffer.from(row.iv),
      key_version: row.key_version,
    });
    return configFromCredentials(shop.shoprenter_shop_name, plain);
  });

  if (!config) {
    console.error("Could not decrypt shop credentials.");
    process.exit(1);
  }

  const groups = await listCustomerGroups(config);
  const group = groups[0];
  if (!group) {
    console.error("No customer groups in Shoprenter.");
    process.exit(1);
  }
  console.log("\nGroup:", group.name, group.id);

  const parseInner = (external: string): number | null => {
    if (/^\d+$/.test(external.trim())) return Number(external.trim());
    return null;
  };
  const innerIds = catalogStats.page.rows
    .map((r) => parseInner(r.external_product_id))
    .filter((n): n is number => n != null);

  // Cold / force sync
  const cold = await withPlatformAdmin(async (client) => {
    const sync = await ensureGroupPriceMirror(
      client,
      config,
      shop.id,
      group.id,
      { force: true },
    );
    if (sync.error) {
      return { sync, mapMs: -1, mappedOwn: 0, own: 0 };
    }
    const tMap = Date.now();
    const map = await mapMirroredPricesForInners(
      client,
      shop.id,
      group.id,
      innerIds,
    );
    const mapMs = Date.now() - tMap;
    const own = await countMirroredGroupPrices(client, shop.id, group.id);
    return { sync, mapMs, mappedOwn: map.size, own };
  });

  console.log("\n=== Cold mirror sync (SR → DB, force) ===");
  console.log({
    syncMs: cold.sync.durationMs,
    synced: cold.sync.synced,
    rowCount: cold.sync.rowCount,
    error: cold.sync.error ?? null,
    mapMirroredPricesMs: cold.mapMs,
    pageOwnHits: cold.mappedOwn,
    ownPriceCount: cold.own,
  });

  // Warm: skip sync + catalog + map (3 rounds)
  const warmRounds: number[] = [];
  for (let i = 0; i < 3; i++) {
    const ms = await withPlatformAdmin(async (client) => {
      const t0 = Date.now();
      const sync = await ensureGroupPriceMirror(
        client,
        config,
        shop.id,
        group.id,
        { force: false },
      );
      const page = await listCatalogPage(client, shop.id, {
        page: 0,
        limit: 50,
      });
      const ids = page.rows
        .map((r) => parseInner(r.external_product_id))
        .filter((n): n is number => n != null);
      await mapMirroredPricesForInners(client, shop.id, group.id, ids);
      await countMirroredGroupPrices(client, shop.id, group.id);
      const total = Date.now() - t0;
      if (i === 0) {
        const meta = await getGroupPriceSyncMeta(client, shop.id, group.id);
        console.log("\n=== Warm path sample ===", {
          mirrorSkipped: sync.skipped,
          mirrorFresh: isMirrorFresh(meta),
          totalMs: total,
        });
      }
      return total;
    });
    warmRounds.push(ms);
  }

  const warmAvg =
    warmRounds.reduce((a, b) => a + b, 0) / Math.max(1, warmRounds.length);
  const warmMax = Math.max(...warmRounds);

  // Legacy estimate: N finds × (RTT + 80ms) / concurrency 4
  const legacyEstimateMs = Math.ceil(innerIds.length / 4) * (250 + 80);

  console.log("\n=== Warm rounds (ensure+catalog+map+count) ===");
  console.log({
    roundsMs: warmRounds,
    avgMs: Math.round(warmAvg),
    maxMs: warmMax,
    targetMs: 200,
    pass: warmMax < 200,
  });

  console.log("\n=== Legacy estimate (old N× findGroupPrice) ===");
  console.log({
    productsOnPage: innerIds.length,
    estimatedMs: legacyEstimateMs,
    note: "250ms RTT + 80ms sleep, concurrency 4 — not executed (would hit SR)",
  });

  console.log("\n=== Verdict ===");
  const pass = warmMax < 200 && cold.sync.error == null;
  console.log(
    pass
      ? `PASS: warm max ${warmMax}ms < 200ms; cold sync ${cold.sync.durationMs}ms once`
      : `CHECK: warm max ${warmMax}ms (target <200); cold error=${cold.sync.error ?? "none"}`,
  );

  process.exit(pass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
