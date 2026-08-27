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
  leaseOwner: string,
  leaseSeconds = 180,
): Promise<SyncJobRow | null> {
  const res = await query<SyncJobRow>(
    client,
    `with candidate as (
       select id
       from sync_jobs
       where status in ('queued', 'running')
         and (lease_until is null or lease_until < now())
       order by created_at
       limit 1
       for update skip locked
     )
     update sync_jobs j
     set status = 'running',
         started_at = coalesce(j.started_at, now()),
         lease_owner = $1,
         lease_until = now() + make_interval(secs => $2)
     from candidate c
     where j.id = c.id
     returning j.id, j.shop_id, j.organization_id, j.kind, j.status,
               j.pages_done, j.pages_total, j.products_upserted,
               j.error_code, j.error_message, j.started_at, j.finished_at,
               j.created_at`,
    [leaseOwner, leaseSeconds],
  );
  return res.rows[0] ?? null;
}

/** Lease megújítás — false = elvesztettük (másik worker / lejárt). */
export async function renewJobLease(
  client: PoolClient,
  jobId: string,
  leaseOwner: string,
  leaseSeconds = 180,
): Promise<boolean> {
  const res = await query<{ id: string }>(
    client,
    `update sync_jobs
     set lease_until = now() + make_interval(secs => $3)
     where id = $1
       and lease_owner = $2
       and status = 'running'
     returning id`,
    [jobId, leaseOwner, leaseSeconds],
  );
  return Boolean(res.rows[0]);
}

export async function releaseJobLease(
  client: PoolClient,
  jobId: string,
  leaseOwner: string,
): Promise<void> {
  await query(
    client,
    `update sync_jobs
     set lease_owner = null,
         lease_until = null
     where id = $1 and lease_owner = $2 and status = 'running'`,
    [jobId, leaseOwner],
  );
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
  // Monoton számlálók — párhuzamos tick / stale write ne ugrasson vissza.
  await query(
    client,
    `update sync_jobs
     set pages_done = greatest(pages_done, $2),
         pages_total = case
           when $3::int is null then pages_total
           when pages_total is null then $3
           else greatest(pages_total, $3)
         end,
         products_upserted = greatest(products_upserted, $4)
     where id = $1`,
    [jobId, patch.pagesDone, patch.pagesTotal, patch.productsUpserted],
  );
  // Only while this job is still running — otherwise a late tick after
  // finishJobSuccess can overwrite catalog_status back to 'syncing' (99% stuck).
  await query(
    client,
    `update shops s
     set catalog_status = 'syncing',
         catalog_product_count = greatest(s.catalog_product_count, $3),
         catalog_synced_at = now(),
         catalog_error = null,
         updated_at = now()
     from sync_jobs j
     where s.id = $1
       and j.id = $2
       and j.shop_id = s.id
       and j.status = 'running'`,
    [shopId, jobId, patch.catalogCount],
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
         catalog_error = 'SKU limit: sync megállt, a widget él',
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
     order by
       case when status in ('queued', 'running') then 0 else 1 end,
       created_at desc
     limit 1`,
    [shopId],
  );
  return res.rows[0] ?? null;
}
