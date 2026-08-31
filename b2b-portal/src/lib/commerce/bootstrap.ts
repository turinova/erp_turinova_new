import type { PoolClient } from "pg";
import { kickCatalogSync } from "@/lib/commerce/loop";
import { kickOrderFactsSync } from "@/lib/commerce/order-facts-loop";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { enqueueFullSync, loadLatestJob } from "@/lib/commerce/jobs";
import { query } from "@/lib/db";
import { softSyncCustomerGroupsFromShoprenter } from "@/lib/merchant/customer-group-sync";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";

export type BootstrapStatus = "pending" | "running" | "ready" | "error";

export type BootstrapStepId = "connect" | "catalog" | "groups" | "orders";

export type BootstrapStep = {
  id: BootstrapStepId;
  label: string;
  done: boolean;
  running: boolean;
  detail: string | null;
};

export type BootstrapSnapshot = {
  status: BootstrapStatus;
  ready: boolean;
  running: boolean;
  error: string | null;
  startedAt: string | null;
  readyAt: string | null;
  progressPct: number;
  steps: BootstrapStep[];
};

type ShopBootstrapRow = {
  id: string;
  last_ping_ok: boolean | null;
  catalog_status: string;
  catalog_product_count: number;
  catalog_error: string | null;
  bootstrap_status: BootstrapStatus;
  bootstrap_started_at: string | null;
  bootstrap_ready_at: string | null;
  bootstrap_error: string | null;
  bootstrap_groups_at: string | null;
  bootstrap_orders_kicked_at: string | null;
};

let bootstrapColumnsChecked = false;
let bootstrapColumnsAvailable = false;

async function ensureBootstrapColumns(client: PoolClient): Promise<boolean> {
  if (bootstrapColumnsChecked) return bootstrapColumnsAvailable;
  bootstrapColumnsChecked = true;
  try {
    const res = await query<{ reg: string | null }>(
      client,
      `select to_regclass('public.shops')::text as reg`,
    );
    if (!res.rows[0]?.reg) {
      bootstrapColumnsAvailable = false;
      return false;
    }
    const col = await query<{ ok: boolean }>(
      client,
      `select exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'shops'
           and column_name = 'bootstrap_status'
       ) as ok`,
    );
    bootstrapColumnsAvailable = Boolean(col.rows[0]?.ok);
  } catch {
    bootstrapColumnsAvailable = false;
  }
  return bootstrapColumnsAvailable;
}

function buildSteps(opts: {
  connected: boolean;
  catalogDone: boolean;
  catalogStatus: string;
  catalogError: string | null;
  productCount: number;
  groupsDone: boolean;
  ordersDone: boolean;
  progressPct: number;
  bootstrapRunning: boolean;
}): BootstrapStep[] {
  const {
    connected,
    catalogDone,
    catalogStatus,
    catalogError,
    productCount,
    groupsDone,
    ordersDone,
    progressPct,
    bootstrapRunning,
  } = opts;

  return [
    {
      id: "connect",
      label: "Kapcsolat",
      done: connected,
      running: bootstrapRunning && !connected,
      detail: connected ? "API OK" : null,
    },
    {
      id: "groups",
      label: "Vevőcsoportok",
      done: groupsDone,
      running: connected && !groupsDone && bootstrapRunning,
      detail: groupsDone ? "Szinkronban" : null,
    },
    {
      id: "catalog",
      label: "Termékek",
      done: catalogDone,
      running:
        connected &&
        !catalogDone &&
        (catalogStatus === "syncing" || catalogStatus === "pending"),
      detail: catalogDone
        ? `${productCount.toLocaleString("hu-HU")} db`
        : catalogError
          ? catalogError.slice(0, 80)
          : progressPct > 0
            ? `${progressPct}%`
            : catalogStatus === "error"
              ? "Hiba"
              : null,
    },
    {
      id: "orders",
      // Kick = háttér; soha ne maradjon örök pulse (037 nélkül / régi shop).
      label: "Rendelések",
      done: ordersDone || catalogDone,
      running: false,
      detail:
        ordersDone || catalogDone ? "Háttérben frissül" : null,
    },
  ];
}

async function loadShopRow(
  client: PoolClient,
  shopId: string,
): Promise<ShopBootstrapRow | null> {
  const hasCols = await ensureBootstrapColumns(client);
  const cols = hasCols
    ? `bootstrap_status, bootstrap_started_at, bootstrap_ready_at,
       bootstrap_error, bootstrap_groups_at, bootstrap_orders_kicked_at`
    : `'pending'::text as bootstrap_status,
       null::timestamptz as bootstrap_started_at,
       null::timestamptz as bootstrap_ready_at,
       null::text as bootstrap_error,
       null::timestamptz as bootstrap_groups_at,
       null::timestamptz as bootstrap_orders_kicked_at`;

  const res = await query<ShopBootstrapRow>(
    client,
    `select id, last_ping_ok, catalog_status, catalog_product_count,
            catalog_error, ${cols}
     from shops where id = $1`,
    [shopId],
  );
  return res.rows[0] ?? null;
}

export async function loadBootstrapSnapshot(
  client: PoolClient,
  shopId: string,
): Promise<BootstrapSnapshot | null> {
  const row = await loadShopRow(client, shopId);
  if (!row) return null;

  const job = await loadLatestJob(client, shopId);
  const pagesDone = job?.pages_done ?? 0;
  const pagesTotal = job?.pages_total;
  const progressPct =
    catalogIsSearchable(row.catalog_status)
      ? 100
      : pagesTotal && pagesTotal > 0
        ? Math.min(99, Math.round((pagesDone / pagesTotal) * 100))
        : 0;

  const hasCols = await ensureBootstrapColumns(client);
  const connected = row.last_ping_ok === true;
  const catalogDone = catalogIsSearchable(row.catalog_status);

  // Régi shop / 037 nélkül: ha a katalógus kész, ne ragadjon a panel.
  let groupsDone = Boolean(row.bootstrap_groups_at) || (catalogDone && connected);
  let ordersDone =
    Boolean(row.bootstrap_orders_kicked_at) || (catalogDone && connected);

  if (hasCols && connected && catalogDone) {
    const patches: string[] = [];
    if (!row.bootstrap_groups_at) {
      patches.push("bootstrap_groups_at = coalesce(bootstrap_groups_at, now())");
      groupsDone = true;
    }
    if (!row.bootstrap_orders_kicked_at) {
      patches.push(
        "bootstrap_orders_kicked_at = coalesce(bootstrap_orders_kicked_at, now())",
      );
      ordersDone = true;
    }
    if (patches.length || row.bootstrap_status !== "ready") {
      await query(
        client,
        `update shops
         set ${patches.concat([
           "bootstrap_status = 'ready'",
           "bootstrap_ready_at = coalesce(bootstrap_ready_at, now())",
           "bootstrap_error = null",
           "updated_at = now()",
         ]).join(", ")}
         where id = $1`,
        [shopId],
      );
    }
  }

  const steps = buildSteps({
    connected,
    catalogDone,
    catalogStatus: row.catalog_status,
    catalogError: row.catalog_error,
    productCount: row.catalog_product_count,
    groupsDone,
    ordersDone,
    progressPct,
    bootstrapRunning:
      hasCols &&
      row.bootstrap_status === "running" &&
      !catalogDone,
  });

  const readyByData = connected && catalogDone && groupsDone;
  const ready =
    readyByData || (hasCols && row.bootstrap_status === "ready");
  const catalogRunning =
    connected &&
    !catalogDone &&
    (row.catalog_status === "syncing" || row.catalog_status === "pending");
  const running = !ready && (catalogRunning || (connected && !catalogDone));

  return {
    status: ready
      ? "ready"
      : row.bootstrap_error
        ? "error"
        : running
          ? "running"
          : connected
            ? "pending"
            : "pending",
    ready,
    running,
    error: row.bootstrap_error,
    startedAt: row.bootstrap_started_at,
    readyAt: row.bootstrap_ready_at,
    progressPct,
    steps,
  };
}

export async function maybeFinishBootstrap(
  client: PoolClient,
  shopId: string,
): Promise<void> {
  if (!(await ensureBootstrapColumns(client))) return;
  const row = await loadShopRow(client, shopId);
  if (!row) return;
  if (row.bootstrap_status === "ready") return;

  const connected = row.last_ping_ok === true;
  const catalogDone = catalogIsSearchable(row.catalog_status);
  if (!connected || !catalogDone) return;

  await query(
    client,
    `update shops
     set bootstrap_status = 'ready',
         bootstrap_ready_at = coalesce(bootstrap_ready_at, now()),
         bootstrap_groups_at = coalesce(bootstrap_groups_at, now()),
         bootstrap_orders_kicked_at = coalesce(bootstrap_orders_kicked_at, now()),
         bootstrap_error = null,
         updated_at = now()
     where id = $1`,
    [shopId],
  );
}

export async function markBootstrapError(
  client: PoolClient,
  shopId: string,
  message: string,
): Promise<void> {
  if (!(await ensureBootstrapColumns(client))) return;
  await query(
    client,
    `update shops
     set bootstrap_status = 'error',
         bootstrap_error = $2,
         updated_at = now()
     where id = $1`,
    [shopId, message.slice(0, 400)],
  );
}

/**
 * Ping után: csoportok → katalógus job → rendelés-tükör kick.
 * Idempotens: futó sync jobot nem duplikálja.
 */
export async function startShopBootstrap(
  client: PoolClient,
  shopId: string,
  organizationId: string,
  config: ShoprenterConfig,
  opts?: { force?: boolean },
): Promise<{ catalogJobId: string }> {
  const force = opts?.force === true;
  const hasCols = await ensureBootstrapColumns(client);

  if (hasCols) {
    await query(
      client,
      `update shops
       set bootstrap_status = 'running',
           bootstrap_started_at = coalesce(bootstrap_started_at, now()),
           bootstrap_ready_at = case when $2 then null else bootstrap_ready_at end,
           bootstrap_error = null,
           bootstrap_groups_at = case when $2 then null else bootstrap_groups_at end,
           bootstrap_orders_kicked_at = case when $2 then null else bootstrap_orders_kicked_at end,
           updated_at = now()
       where id = $1`,
      [shopId, force],
    );
  }

  try {
    await softSyncCustomerGroupsFromShoprenter(client, shopId, config);
    if (hasCols) {
      await query(
        client,
        `update shops set bootstrap_groups_at = now(), updated_at = now() where id = $1`,
        [shopId],
      );
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Vevőcsoportok betöltése sikertelen";
    await markBootstrapError(client, shopId, msg);
    throw err;
  }

  const afterGroups = await loadShopRow(client, shopId);
  const needsCatalog =
    force || !catalogIsSearchable(afterGroups?.catalog_status ?? "pending");

  let catalogJobId = "";
  if (needsCatalog) {
    if (force) {
      await query(
        client,
        `update shops
         set catalog_status = 'pending', catalog_error = null, updated_at = now()
         where id = $1 and catalog_status not in ('blocked_limit')`,
        [shopId],
      );
    }
    const enq = await enqueueFullSync(client, shopId, organizationId);
    catalogJobId = enq.jobId;
  } else {
    await maybeFinishBootstrap(client, shopId);
  }

  if (hasCols) {
    await query(
      client,
      `update shops
       set bootstrap_orders_kicked_at = coalesce(bootstrap_orders_kicked_at, now()),
           updated_at = now()
       where id = $1`,
      [shopId],
    );
  }

  kickBootstrapWorkers();
  return { catalogJobId };
}

/** Katalógus sync siker / limit után hívandó. */
export async function onCatalogSyncFinished(
  client: PoolClient,
  shopId: string,
): Promise<void> {
  await maybeFinishBootstrap(client, shopId);
}

export function kickBootstrapWorkers(): void {
  kickCatalogSync();
  kickOrderFactsSync();
}
