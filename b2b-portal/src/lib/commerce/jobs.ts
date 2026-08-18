import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type SyncJobKind = "full" | "incremental";
export type SyncJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "blocked_limit";

export type SyncJobRow = {
  id: string;
  shop_id: string;
  organization_id: string;
  kind: SyncJobKind;
  status: SyncJobStatus;
  pages_done: number;
  pages_total: number | null;
  products_upserted: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type CatalogShopRow = {
  id: string;
  organization_id: string;
  shoprenter_shop_name: string;
  store_url: string | null;
  status: string;
  catalog_status: string;
  catalog_product_count: number;
  catalog_ready_at: string | null;
  catalog_synced_at: string | null;
  catalog_error: string | null;
  purged_at: string | null;
  platform: string;
};

export async function enqueueFullSync(
  client: PoolClient,
  shopId: string,
  organizationId: string,
): Promise<{ jobId: string; created: boolean }> {
  const existing = await query<{ id: string }>(
    client,
    `select id from sync_jobs
     where shop_id = $1 and status in ('queued', 'running')
     limit 1`,
    [shopId],
  );
  if (existing.rows[0]) {
    return { jobId: existing.rows[0].id, created: false };
  }

  const last = await query<{ status: SyncJobStatus }>(
    client,
    `select status from sync_jobs where shop_id = $1
     order by created_at desc limit 1`,
    [shopId],
  );
  if (last.rows[0]?.status !== "blocked_limit") {
    await saveCursor(client, shopId, null);
  }

  const ins = await query<{ id: string }>(
    client,
    `insert into sync_jobs (shop_id, organization_id, kind, status)
     values ($1, $2, 'full', 'queued')
     returning id`,
    [shopId, organizationId],
  ).catch(async (err: unknown) => {
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code !== "23505") throw err;
    const again = await query<{ id: string }>(
      client,
      `select id from sync_jobs
       where shop_id = $1 and status in ('queued', 'running') limit 1`,
      [shopId],
    );
    if (!again.rows[0]) throw err;
    return again;
  });

  await query(
    client,
    `update shops
     set catalog_status = case
           when catalog_status = 'ready' then 'ready'
           when catalog_status = 'blocked_limit' then 'blocked_limit'
           else 'pending'
         end,
         catalog_error = null,
         updated_at = now()
     where id = $1`,
    [shopId],
  );

  return { jobId: ins.rows[0].id, created: true };
}

export async function claimNextJob(
  client: PoolClient,
): Promise<SyncJobRow | null> {
  const res = await query<SyncJobRow>(
    client,
    `select id, shop_id, organization_id, kind, status,
            pages_done, pages_total, products_upserted,
            error_code, error_message, started_at, finished_at, created_at
     from sync_jobs
     where status in ('queued', 'running')
     order by created_at
     limit 1
     for update skip locked`,
  );
  const job = res.rows[0];
  if (!job) return null;

  if (job.status === "queued") {
    await query(
      client,
      `update sync_jobs
       set status = 'running', started_at = coalesce(started_at, now())
       where id = $1`,
      [job.id],
    );
    job.status = "running";
    job.started_at = job.started_at ?? new Date().toISOString();
  }
  return job;
}

export async function loadShopForSync(
  client: PoolClient,
  shopId: string,
): Promise<CatalogShopRow | null> {
  const res = await query<CatalogShopRow>(
    client,
    `select id, organization_id, shoprenter_shop_name, store_url, status,
            catalog_status, catalog_product_count, catalog_ready_at,
            catalog_synced_at, catalog_error, purged_at, platform
     from shops where id = $1`,
    [shopId],
  );
  return res.rows[0] ?? null;
}

export async function getCursor(
  client: PoolClient,
  shopId: string,
): Promise<string | null> {
  const res = await query<{ cursor: string | null }>(
    client,
    `select cursor from sync_cursors where shop_id = $1 and resource = 'products'`,
    [shopId],
  );
  return res.rows[0]?.cursor ?? null;
}

export async function saveCursor(
  client: PoolClient,
  shopId: string,
  cursor: string | null,
): Promise<void> {
  await query(
    client,
    `insert into sync_cursors (shop_id, resource, cursor, updated_at)
     values ($1, 'products', $2, now())
     on conflict (shop_id, resource) do update set
       cursor = excluded.cursor,
       updated_at = now()`,
    [shopId, cursor],
  );
}

export async function markJobProgress(
  client: PoolClient,
  jobId: string,
  shopId: string,
  patch: {
    pagesDone: number;
    pagesTotal: number | null;
    productsUpserted: number;
    catalogCount: number;
  },
): Promise<void> {
  await query(
    client,
    `update sync_jobs
     set pages_done = $2, pages_total = $3, products_upserted = $4
     where id = $1`,
    [jobId, patch.pagesDone, patch.pagesTotal, patch.productsUpserted],
  );
  await query(
    client,
    `update shops
     set catalog_status = 'syncing',
         catalog_product_count = $2,
         catalog_synced_at = now(),
         catalog_error = null,
         updated_at = now()
     where id = $1`,
    [shopId, patch.catalogCount],
  );
}

export async function finishJobSuccess(
  client: PoolClient,
  jobId: string,
  shopId: string,
  catalogCount: number,
): Promise<void> {
  await query(
    client,
    `update sync_jobs
     set status = 'succeeded', finished_at = now()
     where id = $1`,
    [jobId],
  );
  await query(
    client,
    `update shops
     set catalog_status = 'ready',
         catalog_ready_at = coalesce(catalog_ready_at, now()),
         catalog_product_count = $2,
         catalog_synced_at = now(),
         catalog_error = null,
         updated_at = now()
     where id = $1`,
    [shopId, catalogCount],
  );
  await saveCursor(client, shopId, null);
}

export async function finishJobBlocked(
  client: PoolClient,
  jobId: string,
  shopId: string,
  catalogCount: number,
): Promise<void> {
  await query(
    client,
    `update sync_jobs
     set status = 'blocked_limit', finished_at = now(),
         error_code = 'sku_limit', error_message = 'SKU soft cap elérve'
     where id = $1`,
    [jobId],
  );
  await query(
    client,
    `update shops
     set catalog_status = 'blocked_limit',
         catalog_product_count = $2,
         catalog_synced_at = now(),
         catalog_error = 'SKU limit — sync megállt, a widget él',
         updated_at = now()
     where id = $1`,
    [shopId, catalogCount],
  );
}

export async function finishJobFailed(
  client: PoolClient,
  job: { id: string; shop_id: string },
  code: string,
  message: string,
  shopStatus?: "needs_reauth",
): Promise<void> {
  await query(
    client,
    `update sync_jobs
     set status = 'failed', finished_at = now(),
         error_code = $2, error_message = $3
     where id = $1`,
    [job.id, code, message.slice(0, 500)],
  );
  await query(
    client,
    `update shops
     set catalog_status = 'error',
         catalog_error = $2,
         status = case when $3::text = 'needs_reauth' then 'needs_reauth' else status end,
         updated_at = now()
     where id = $1`,
    [job.shop_id, message.slice(0, 400), shopStatus ?? null],
  );
}

export async function loadLatestJob(
  client: PoolClient,
  shopId: string,
): Promise<SyncJobRow | null> {
  const res = await query<SyncJobRow>(
    client,
    `select id, shop_id, organization_id, kind, status,
            pages_done, pages_total, products_upserted,
            error_code, error_message, started_at, finished_at, created_at
     from sync_jobs
     where shop_id = $1
     order by created_at desc
     limit 1`,
    [shopId],
  );
  return res.rows[0] ?? null;
}
