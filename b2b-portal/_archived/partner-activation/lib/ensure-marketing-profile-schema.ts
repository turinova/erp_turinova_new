/**
 * Ensures shops.marketing_profile column exists (IF NOT EXISTS).
 */
import type { PoolClient } from "pg";
import { withPlatformAdmin } from "@/lib/db";

const SCHEMA_VERSION = 1;

declare global {
  // eslint-disable-next-line no-var
  var __b2bMarketingProfileSchemaVersion: number | undefined;
}

async function runDdl(client: PoolClient): Promise<void> {
  await client.query(`
    alter table public.shops
      add column if not exists marketing_profile jsonb not null default '{}'::jsonb
  `);
  await client.query(`
    insert into public.schema_migrations (filename)
    values ('035_marketing_profile.sql')
    on conflict (filename) do nothing
  `).catch(() => {
    /* optional */
  });
}

export async function ensureMarketingProfileSchema(): Promise<void> {
  if (globalThis.__b2bMarketingProfileSchemaVersion === SCHEMA_VERSION) return;
  await withPlatformAdmin(async (client) => {
    await runDdl(client);
  });
  globalThis.__b2bMarketingProfileSchemaVersion = SCHEMA_VERSION;
}
