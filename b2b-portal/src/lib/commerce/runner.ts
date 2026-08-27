import { randomBytes } from "crypto";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin } from "@/lib/db";
import { effectiveSkuLimit } from "@/lib/billing/active-partners";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import type { ShopCredentialsPlain } from "@/types/db";
import {
  countOrgActiveSkus,
  countShopCatalog,
  deactivateStaleCatalogProducts,
  replaceShopProductCategoryLinks,
  upsertCatalogCategories,
  upsertCatalogPage,
} from "./catalog";
import {
  claimNextJob,
  finishJobBlocked,
  finishJobFailed,
  finishJobSuccess,
  getCursor,
  loadShopForSync,
  markJobProgress,
  releaseJobLease,
  renewJobLease,
  saveCursor,
  type SyncJobRow,
} from "./jobs";
import {
  createShoprenterAdapter,
  type CategoryMeta,
  type ProductCategoryLink,
  type ShoprenterAdapter,
} from "./shoprenter-adapter";

const MAX_PAGES_PER_TICK = 8;
const MAX_429 = 8;
const LEASE_SECONDS = 180;

let tickBusy = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newLeaseOwner(): string {
  return `w-${process.pid}-${randomBytes(4).toString("hex")}`;
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

async function runClaimedJob(
  job: SyncJobRow,
  leaseOwner: string,
): Promise<"continue" | "done"> {
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

  const adapter: ShoprenterAdapter = createShoprenterAdapter(config);
  const cursor = await withPlatformAdmin((client) =>
    getCursor(client, shop.id),
  );

  let pagesDone = job.pages_done;
  let productsUpserted = job.products_upserted;
  let pagesTotal = job.pages_total;
  let nextCursor = cursor;
  let consecutive429 = 0;
  let categoryBootstrapDone = Boolean(nextCursor);

  for (let i = 0; i < MAX_PAGES_PER_TICK; i++) {
    const stillMine = await withPlatformAdmin((client) =>
      renewJobLease(client, job.id, leaseOwner, LEASE_SECONDS),
    );
    if (!stillMine) {
      console.warn("[catalog-sync] lease lost", job.id);
      return "continue";
    }

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
              "Shoprenter 429: túl sok retry",
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

    if (page.pageCount != null) {
      pagesTotal =
        pagesTotal == null
          ? page.pageCount
          : Math.max(pagesTotal, page.pageCount);
    }

    // SR hívások DB connectionön kívül (kategória fa + M:N linkek).
    let categoriesMeta: CategoryMeta[] | null = null;
    let categoryLinks: ProductCategoryLink[] | null = null;
    if (!categoryBootstrapDone && !nextCursor) {
      try {
        const meta = await adapter.getCategoriesMeta();
        categoriesMeta = meta.size ? [...meta.values()] : [];
      } catch (e) {
        console.warn("[sync] catalog categories", e);
        categoriesMeta = [];
      }
      try {
        categoryLinks = await adapter.getProductCategoryLinks();
      } catch (e) {
        console.warn("[sync] product category links", e);
        categoryLinks = [];
      }
      categoryBootstrapDone = true;
    }

    const upserted = await withPlatformAdmin(async (client) => {
      if (categoriesMeta?.length) {
        await upsertCatalogCategories(client, shop.id, categoriesMeta);
      }
      if (categoryLinks?.length) {
        const n = await replaceShopProductCategoryLinks(
          client,
          shop.id,
          categoryLinks,
        );
        console.info("[sync] product↔category links", n);
      }
      categoriesMeta = null;
      categoryLinks = null;

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
        // Keep lease alive during stale cleanup (can be slow on large catalogs)
        // so another worker cannot reclaim and markJobProgress→syncing after ready.
        await renewJobLease(client, job.id, leaseOwner, LEASE_SECONDS);
        const startedAt = job.started_at ?? new Date().toISOString();
        const deactivated = await deactivateStaleCatalogProducts(
          client,
          shop.id,
          startedAt,
        );
        if (deactivated > 0) {
          console.info(
            `[catalog-sync] shop=${shop.id} deactivated_stale=${deactivated}`,
          );
        }
        const finalCount = await countShopCatalog(client, shop.id);
        await finishJobSuccess(client, job.id, shop.id, finalCount);
        return {
          blocked: false as const,
          done: true as const,
          catalogCount: finalCount,
        };
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
  const leaseOwner = newLeaseOwner();
  let job: SyncJobRow | null = null;
  try {
    job = await withPlatformAdmin((client) =>
      claimNextJob(client, leaseOwner, LEASE_SECONDS),
    );
    if (!job) return;

    try {
      await runClaimedJob(job, leaseOwner);
    } catch (err) {
      console.error("[catalog-sync]", err);
      try {
        await withPlatformAdmin((client) =>
          finishJobFailed(
            client,
            job!,
            "crash",
            err instanceof Error ? err.message : "Ismeretlen hiba",
          ),
        );
      } catch (inner) {
        console.error("[catalog-sync] fail-mark", inner);
      }
    }
  } finally {
    if (job) {
      try {
        await withPlatformAdmin((client) =>
          releaseJobLease(client, job!.id, leaseOwner),
        );
      } catch (e) {
        console.warn("[catalog-sync] release lease", e);
      }
    }
    tickBusy = false;
  }
}
