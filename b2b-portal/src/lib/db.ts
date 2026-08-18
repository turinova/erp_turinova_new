import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import type { DbTenantContext } from "@/types/db";

/**
 * Postgres pool — migrations are MANUAL (see b2b-portal/sql/).
 * Never run DDL from the app.
 */

declare global {
  // eslint-disable-next-line no-var
  var __b2bPgPool: Pool | undefined;
}

/**
 * Vercel + Supabase pooler: the pooler cert chain is not verify-full
 * compatible (self-signed in chain). Encrypt in transit, do not pin CA.
 * Strip sslmode from the URI so pg-connection-string does not warn.
 */
function connectionStringForPool(url: string, onVercel: boolean): string {
  if (!onVercel) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("uselibpqcompat");
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return url;
  }
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Set it in .env.local after running sql/001–011 manually.",
    );
  }
  const onVercel = Boolean(process.env.VERCEL);
  return new Pool({
    connectionString: connectionStringForPool(url, onVercel),
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: 30_000,
    ssl: onVercel ? { rejectUnauthorized: false } : undefined,
  });
}

export function getPool(): Pool {
  if (!global.__b2bPgPool) {
    global.__b2bPgPool = createPool();
    void import("@/lib/commerce/loop")
      .then((m) => m.startCatalogSyncLoop())
      .catch((err) => console.error("[catalog-sync] loop start", err));
  }
  return global.__b2bPgPool;
}

async function applyTenantContext(
  client: PoolClient,
  ctx: DbTenantContext,
): Promise<void> {
  // Transaction-local (third arg true) — safe with pooled connections
  await client.query(`select set_config('app.organization_id', $1, true)`, [
    ctx.organizationId ?? "",
  ]);
  await client.query(`select set_config('app.user_id', $1, true)`, [
    ctx.userId ?? "",
  ]);
  await client.query(`select set_config('app.is_platform_admin', $1, true)`, [
    ctx.isPlatformAdmin ? "true" : "false",
  ]);
}

/**
 * Run queries inside a transaction with RLS session variables set.
 */
export async function withTenant<T>(
  ctx: DbTenantContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    await applyTenantContext(client, ctx);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Platform / bootstrap queries (sets is_platform_admin for RLS). */
export async function withPlatformAdmin<T>(
  fn: (client: PoolClient) => Promise<T>,
  userId?: string | null,
): Promise<T> {
  return withTenant(
    {
      organizationId: null,
      userId: userId ?? null,
      isPlatformAdmin: true,
    },
    fn,
  );
}

export async function query<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return client.query<T>(text, params);
}

/** Health check — does not set tenant context (use after migrations). */
export async function pingDatabase(): Promise<{ ok: true; now: string }> {
  const pool = getPool();
  const res = await pool.query<{ now: string }>("select now()::text as now");
  return { ok: true, now: res.rows[0]?.now ?? "" };
}
