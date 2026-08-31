import type { PoolClient } from "pg";
import { query, withPlatformAdmin } from "@/lib/db";
import {
  listGroupMap,
  loadMerchantShoprenterConfig,
  percentDiscountFromDb,
  type GroupMapItemDto,
  type GroupMapRow,
} from "@/lib/merchant/customer-group-map";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  listCustomerGroups,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";
import { mapTierProductCountsByGroup } from "@/lib/commerce/volume-tier-mirror";

function pctForDb(pct: number | null | undefined): number {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(100, Math.max(0, Math.trunc(pct)));
}

function mapNeedsPercentBackfill(rows: GroupMapRow[]): boolean {
  return rows.length > 0 && rows.some((r) => r.percent_discount == null);
}

/** SR vevőcsoportok → shop_customer_group_map (meglévő role-ok megmaradnak). */
export async function softSyncCustomerGroupsFromShoprenter(
  client: PoolClient,
  shopId: string,
  config: ShoprenterConfig,
): Promise<{ count: number }> {
  const srGroups = await listCustomerGroups(config);
  for (const g of srGroups) {
    await client.query(
      `insert into shop_customer_group_map (
         shop_id, sr_group_inner_id, sr_group_id, sr_name_snapshot,
         role, is_default_in_sr, percent_discount
       ) values ($1,$2,$3,$4,'bolt',$5,$6)
       on conflict (shop_id, sr_group_inner_id) do update set
         sr_group_id = excluded.sr_group_id,
         sr_name_snapshot = excluded.sr_name_snapshot,
         is_default_in_sr = excluded.is_default_in_sr,
         percent_discount = excluded.percent_discount,
         updated_at = now()`,
      [shopId, g.innerId, g.id, g.name, g.isDefault, pctForDb(g.percentDiscount)],
    );
  }
  return { count: srGroups.length };
}

/** DB map → SR-kompatibilis lista (élő SR hívás nélkül). */
export function srGroupsFromMap(rows: GroupMapRow[]): SrCustomerGroup[] {
  return rows.map((r) => ({
    id: r.sr_group_id || String(r.sr_group_inner_id),
    innerId: r.sr_group_inner_id,
    name: r.sr_name_snapshot || `Csoport #${r.sr_group_inner_id}`,
    percentDiscount: percentDiscountFromDb(r.percent_discount),
    isDefault: r.is_default_in_sr,
  }));
}

/**
 * Prefer DB map. Soft-sync from SR only if map empty or forceSync.
 */
export async function resolveCustomerGroups(
  client: PoolClient,
  shopId: string,
  config: ShoprenterConfig,
  opts?: { forceSync?: boolean },
): Promise<SrCustomerGroup[]> {
  let rows = await listGroupMap(client, shopId);
  if (
    opts?.forceSync ||
    rows.length === 0 ||
    mapNeedsPercentBackfill(rows)
  ) {
    await softSyncCustomerGroupsFromShoprenter(client, shopId, config);
    rows = await listGroupMap(client, shopId);
  }
  return srGroupsFromMap(rows);
}

/** Merchant UI DTO a mapból (+ opcionális élő percent, ha van). */
export async function groupMapItemsFromDb(
  client: PoolClient,
  shopId: string,
  opts?: {
    forceSync?: boolean;
    config?: ShoprenterConfig;
    liveGroups?: Awaited<ReturnType<typeof listCustomerGroups>>;
  },
): Promise<GroupMapItemDto[]> {
  if (opts?.forceSync && opts.config) {
    await softSyncCustomerGroupsFromShoprenter(client, shopId, opts.config);
  }

  let mapRows = await listGroupMap(client, shopId);
  if (
    opts?.config &&
    (mapRows.length === 0 || mapNeedsPercentBackfill(mapRows))
  ) {
    await softSyncCustomerGroupsFromShoprenter(client, shopId, opts.config);
    mapRows = await listGroupMap(client, shopId);
  }
  const refreshed = mapRows;
  const tierByOuter = await mapTierProductCountsByGroup(client, shopId);
  const liveByInner = new Map(
    (opts?.liveGroups ?? []).map((g) => [g.innerId, g]),
  );

  const groups: GroupMapItemDto[] = [];
  const seen = new Set<number>();

  for (const row of refreshed) {
    seen.add(row.sr_group_inner_id);
    const live = liveByInner.get(row.sr_group_inner_id);
    const oid = row.sr_group_id;
    groups.push({
      innerId: row.sr_group_inner_id,
      groupId: oid,
      name: row.sr_name_snapshot || `Csoport #${row.sr_group_inner_id}`,
      role: row.role,
      isDefault: row.is_default_in_sr,
      percentDiscount:
        live?.percentDiscount ??
        percentDiscountFromDb(row.percent_discount),
      tierProductCount: oid ? (tierByOuter.get(oid) ?? 0) : 0,
      missingFromShop: false,
    });
  }

  for (const g of opts?.liveGroups ?? []) {
    if (seen.has(g.innerId)) continue;
    groups.push({
      innerId: g.innerId,
      groupId: g.id,
      name: g.name,
      role: "bolt",
      isDefault: g.isDefault,
      percentDiscount: g.percentDiscount,
      tierProductCount: g.id ? (tierByOuter.get(g.id) ?? 0) : 0,
      missingFromShop: false,
    });
  }

  return groups;
}

/** Cron: soft-sync groups for shops with credentials (rate-limit barát). */
export async function processCustomerGroupsSyncBatch(
  limit = 8,
): Promise<{ shops: number; synced: number; errors: number }> {
  return withPlatformAdmin(async (client) => {
    const shops = await query<{
      id: string;
      organization_id: string;
    }>(
      client,
      `select s.id, s.organization_id
       from shops s
       join shop_credentials c on c.shop_id = s.id
       where s.purged_at is null
         and s.status in ('active', 'needs_reauth')
       order by coalesce(
         (select max(updated_at) from shop_customer_group_map m where m.shop_id = s.id),
         s.created_at
       ) asc
       limit $1`,
      [limit],
    );

    let synced = 0;
    let errors = 0;
    for (const shop of shops.rows) {
      try {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          shop.organization_id,
        );
        if (!loaded) continue;
        await softSyncCustomerGroupsFromShoprenter(
          client,
          loaded.shopId,
          loaded.config,
        );
        synced += 1;
      } catch (err) {
        errors += 1;
        console.error("[groups-sync]", shop.id, err);
      }
    }
    return { shops: shops.rows.length, synced, errors };
  });
}
