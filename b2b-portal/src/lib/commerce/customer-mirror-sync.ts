/**
 * Vékony vevő-tükör sync: Shoprenter customers → shop_customers.
 * Rate-limit barát (≤2–3 rps), cursor a shop_customer_sync_state-ben.
 */

import type { PoolClient } from "pg";
import { query, withPlatformAdmin, withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { upsertShopCustomer } from "@/lib/merchant/shop-customers";
import { listRecentCustomers } from "@/lib/shoprenter/customers";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";

const PAGE_LIMIT = 50;
const PAGES_PER_TICK = 2;
const PAGE_GAP_MS = 450;
const SHOPS_PER_TICK = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function schemaReady(client: PoolClient): Promise<boolean> {
  const res = await query<{ reg: string | null }>(
    client,
    `select to_regclass('public.shop_customer_sync_state')::text as reg`,
  );
  return Boolean(res.rows[0]?.reg);
}

type ShopPick = { id: string; organization_id: string };

async function pickShops(
  client: PoolClient,
  limit: number,
): Promise<ShopPick[]> {
  const res = await query<ShopPick>(
    client,
    `select s.id, s.organization_id
     from shops s
     left join shop_customer_sync_state st on st.shop_id = s.id
     where s.purged_at is null
       and (st.status is null or st.status <> 'running')
     order by st.last_run_at nulls first
     limit $1`,
    [limit],
  );
  return res.rows;
}

async function syncOneShop(
  organizationId: string,
  shopId: string,
  config: ShoprenterConfig,
): Promise<{ upserted: number; done: boolean }> {
  return withTenant(
    { organizationId, userId: null },
    async (client) => {
      if (!(await schemaReady(client))) {
        return { upserted: 0, done: true };
      }

      await query(
        client,
        `insert into shop_customer_sync_state (shop_id, cursor_page, status, last_run_at)
         values ($1, 0, 'running', now())
         on conflict (shop_id) do update set
           status = 'running',
           last_run_at = now(),
           last_error = null`,
        [shopId],
      );

      const stateRes = await query<{ cursor_page: number }>(
        client,
        `select cursor_page from shop_customer_sync_state where shop_id = $1`,
        [shopId],
      );
      let page = stateRes.rows[0]?.cursor_page ?? 0;
      let upserted = 0;
      let done = false;

      try {
        for (let i = 0; i < PAGES_PER_TICK; i++) {
          const listed = await listRecentCustomers(config, {
            limit: PAGE_LIMIT,
            page,
          });
          for (const c of listed.customers) {
            const name =
              [c.lastname, c.firstname].filter(Boolean).join(" ").trim() ||
              c.email;
            await upsertShopCustomer(client, {
              shopId,
              srCustomerInnerId: c.innerId,
              srCustomerId: c.id,
              email: c.email,
              nameSnapshot: name,
              phoneSnapshot: c.telephone,
              srGroupInnerId: c.groupInnerId,
              srGroupNameSnapshot: c.groupName,
              srStatus: "active",
              approved: c.approved,
              dateCreatedSr: c.dateCreated,
            });
            upserted += 1;
          }

          const pageCount = Math.max(1, listed.pageCount);
          if (listed.customers.length === 0 || page + 1 >= pageCount) {
            done = true;
            page = 0;
            break;
          }
          page += 1;
          await sleep(PAGE_GAP_MS);
        }

        await query(
          client,
          `update shop_customer_sync_state set
             cursor_page = $2,
             row_count = row_count + $3,
             status = $4,
             last_run_at = now(),
             last_error = null
           where shop_id = $1`,
          [shopId, page, upserted, done ? "done" : "idle"],
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await query(
          client,
          `update shop_customer_sync_state set
             status = 'error', last_error = $2, last_run_at = now()
           where shop_id = $1`,
          [shopId, msg.slice(0, 500)],
        );
        throw err;
      }

      return { upserted, done };
    },
  );
}

export async function processCustomerMirrorSyncTick(opts?: {
  shopLimit?: number;
}): Promise<{ shops: number; upserted: number; errors: number }> {
  const ready = await withPlatformAdmin(async (client) =>
    schemaReady(client),
  );
  if (!ready) {
    return { shops: 0, upserted: 0, errors: 0 };
  }

  const shops = await withPlatformAdmin(async (client) =>
    pickShops(client, opts?.shopLimit ?? SHOPS_PER_TICK),
  );

  let upserted = 0;
  let errors = 0;

  for (const shop of shops) {
    try {
      const loaded = await withTenant(
        { organizationId: shop.organization_id, userId: null },
        async (client) =>
          loadMerchantShoprenterConfig(client, shop.organization_id),
      );
      if (!loaded) continue;
      const r = await syncOneShop(
        shop.organization_id,
        shop.id,
        loaded.config,
      );
      upserted += r.upserted;
    } catch (err) {
      errors += 1;
      console.error("[customer-mirror]", shop.id, err);
    }
    await sleep(300);
  }

  return { shops: shops.length, upserted, errors };
}
