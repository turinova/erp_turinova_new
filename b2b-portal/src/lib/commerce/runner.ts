import { decryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin } from "@/lib/db";
import { effectiveSkuLimit } from "@/lib/billing/active-partners";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import type { ShopCredentialsPlain } from "@/types/db";
import { countOrgActiveSkus, countShopCatalog, upsertCatalogPage } from "./catalog";
import {
  claimNextJob,
  finishJobBlocked,
  finishJobFailed,
  finishJobSuccess,
  getCursor,
  loadShopForSync,
  markJobProgress,
  saveCursor,
  type SyncJobRow,
} from "./jobs";
import { createShoprenterAdapter } from "./shoprenter-adapter";

const MAX_PAGES_PER_TICK = 8;
const MAX_429 = 8;

let tickBusy = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatus(err: unknown): number | null {
  if (typeof err === "object" && err && "status" in err) {
    const n = Number((err as { status?: number }).status);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function loadShopConfig(shopId: string, shopName: string) {
  return withPlatformAdmin(async (client) => {
    const res = await query<{
      auth_type: "oauth" | "basic_legacy";
      ciphertext: Buffer;
      iv: Buffer;
      key_version: number;
    }>(
      client,
      `select auth_type, ciphertext, iv, key_version
       from shop_credentials where shop_id = $1`,
      [shopId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const plain = decryptCredentials({
      ciphertext: Buffer.from(row.ciphertext),
      iv: Buffer.from(row.iv),
      key_version: row.key_version,
    }) as ShopCredentialsPlain;
    return configFromCredentials(shopName, plain);
  });
}

async function runClaimedJob(job: SyncJobRow): Promise<"continue" | "done"> {
  const shop = await withPlatformAdmin((client) =>
    loadShopForSync(client, job.shop_id),
  );
  if (!shop || shop.purged_at) {
    await withPlatformAdmin((client) =>
      finishJobFailed(client, job, "no_shop", "Shop hiányzik vagy törölve"),
    );
    return "done";
  }
  if (shop.status === "needs_reauth" || shop.status === "uninstalled") {
    await withPlatformAdmin((client) =>
      finishJobFailed(
        client,
        job,
        "shop_status",
        `Shop státusz: ${shop.status}`,
        shop.status === "needs_reauth" ? "needs_reauth" : undefined,
      ),
    );
    return "done";
  }

  const config = await loadShopConfig(shop.id, shop.shoprenter_shop_name);
  if (!config) {
    await withPlatformAdmin((client) =>
      finishJobFailed(
        client,
        job,
        "no_creds",
        "Nincs API kulcs",
        "needs_reauth",
      ),
    );
    return "done";
  }

  const adapter = createShoprenterAdapter(config);
  const cursor = await withPlatformAdmin((client) =>
    getCursor(client, shop.id),
  );

  let pagesDone = job.pages_done;
  let productsUpserted = job.products_upserted;
  let pagesTotal = job.pages_total;
  let nextCursor = cursor;
  let consecutive429 = 0;

  for (let i = 0; i < MAX_PAGES_PER_TICK; i++) {
    let page;
    try {
      page = await adapter.listProductsPage(nextCursor);
      consecutive429 = 0;
    } catch (err) {
      const status = httpStatus(err);
      if (status === 429) {
        consecutive429++;
        if (consecutive429 >= MAX_429) {
          await withPlatformAdmin((client) =>
            finishJobFailed(
              client,
              job,
              "rate_limit",
              "Shoprenter 429 — túl sok retry",
            ),
          );
          return "done";
        }
        await sleep(Math.min(8000, 1000 * 2 ** consecutive429));
        return "continue";
      }
      if (status === 401 || status === 403) {
        await withPlatformAdmin((client) =>
          finishJobFailed(
            client,
            job,
            "auth",
            err instanceof Error ? err.message : "Auth hiba",
            "needs_reauth",
          ),
        );
        return "done";
      }
      await withPlatformAdmin((client) =>
        finishJobFailed(
          client,
          job,
          "adapter",
          err instanceof Error ? err.message : "Adapter hiba",
        ),
      );
      return "done";
    }

    if (page.pageCount != null) pagesTotal = page.pageCount;

    const upserted = await withPlatformAdmin(async (client) => {
      const result = await upsertCatalogPage(
        client,
        shop.id,
        adapter.platform,
        page.items,
      );
      productsUpserted += result.upserted;
      pagesDone += 1;
      const catalogCount = await countShopCatalog(client, shop.id);
      await saveCursor(client, shop.id, page.nextCursor);
      await markJobProgress(client, job.id, shop.id, {
        pagesDone,
        pagesTotal,
        productsUpserted,
        catalogCount,
      });

      const skuLimit = await effectiveSkuLimit(client, shop.organization_id);
      const skuUsed = await countOrgActiveSkus(client, shop.organization_id);
      if (skuUsed >= skuLimit && page.nextCursor) {
        await finishJobBlocked(client, job.id, shop.id, catalogCount);
        return { blocked: true as const, catalogCount };
      }
      if (!page.nextCursor) {
        await finishJobSuccess(client, job.id, shop.id, catalogCount);
        return { blocked: false as const, done: true as const, catalogCount };
      }
      return { blocked: false as const, done: false as const, catalogCount };
    });

    if (upserted.blocked || upserted.done) return "done";

    nextCursor = page.nextCursor;
    await sleep(adapter.rateLimit.pageDelayMs);
  }

  return "continue";
}

/** Process queued/running jobs. Safe to call from the loop or after enqueue. */
export async function processCatalogSyncTick(): Promise<void> {
  if (process.env.SYNC_WORKER_DISABLED === "1") return;
  if (tickBusy) return;
  tickBusy = true;
  try {
    const job = await withPlatformAdmin((client) => claimNextJob(client));
    if (!job) return;

    try {
      await runClaimedJob(job);
    } catch (err) {
      console.error("[catalog-sync]", err);
      try {
        await withPlatformAdmin((client) =>
          finishJobFailed(
            client,
            job,
            "crash",
            err instanceof Error ? err.message : "Ismeretlen hiba",
          ),
        );
      } catch (inner) {
        console.error("[catalog-sync] fail-mark", inner);
      }
    }
  } finally {
    tickBusy = false;
  }
}
