import { query, withPlatformAdmin } from "@/lib/db";
import type { ShopStatus } from "@/types/db";

export type EmbedShopRow = {
  shopId: string;
  organizationId: string;
  shopName: string;
  publicId: string;
  storeUrl: string | null;
  status: ShopStatus;
  widgetEnabled: boolean;
  catalogStatus: string | null;
  catalogSyncedAt: string | null;
  orgPlan: string | null;
  orgStatus: string | null;
  trialEndsAt: string | null;
  hasCredentials: boolean;
};

type Row = {
  shop_id: string;
  organization_id: string;
  shoprenter_shop_name: string;
  public_id: string;
  store_url: string | null;
  status: ShopStatus;
  widget_enabled: boolean;
  catalog_status: string | null;
  catalog_synced_at: Date | string | null;
  org_plan: string | null;
  org_status: string | null;
  trial_ends_at: Date | string | null;
  has_credentials: boolean;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRow(row: Row): EmbedShopRow {
  return {
    shopId: row.shop_id,
    organizationId: row.organization_id,
    shopName: row.shoprenter_shop_name,
    publicId: row.public_id,
    storeUrl: row.store_url,
    status: row.status,
    widgetEnabled: row.widget_enabled,
    catalogStatus: row.catalog_status,
    catalogSyncedAt: toIso(row.catalog_synced_at),
    orgPlan: row.org_plan,
    orgStatus: row.org_status,
    trialEndsAt: toIso(row.trial_ends_at),
    hasCredentials: row.has_credentials,
  };
}

const SELECT = `
  select
    s.id as shop_id,
    s.organization_id,
    s.shoprenter_shop_name,
    s.public_id,
    s.store_url,
    s.status,
    s.widget_enabled,
    s.catalog_status,
    s.catalog_synced_at,
    o.plan as org_plan,
    o.status as org_status,
    o.trial_ends_at,
    exists(
      select 1 from shop_credentials c where c.shop_id = s.id
    ) as has_credentials
  from shops s
  join organizations o on o.id = s.organization_id
`;

export async function findEmbedShopByName(
  shopName: string,
): Promise<EmbedShopRow | null> {
  const name = shopName.trim().toLowerCase();
  if (!name) return null;
  return withPlatformAdmin(async (client) => {
    const res = await query<Row>(
      client,
      `${SELECT}
       where lower(s.shoprenter_shop_name) = $1
       limit 1`,
      [name],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  });
}

export async function findEmbedShopById(
  shopId: string,
): Promise<EmbedShopRow | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<Row>(
      client,
      `${SELECT}
       where s.id = $1
       limit 1`,
      [shopId],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  });
}

export async function markShopUninstalled(shopName: string): Promise<boolean> {
  const name = shopName.trim().toLowerCase();
  if (!name) return false;
  return withPlatformAdmin(async (client) => {
    const res = await query(
      client,
      `update shops
       set status = 'uninstalled',
           widget_enabled = false,
           updated_at = now()
       where lower(shoprenter_shop_name) = $1`,
      [name],
    );
    return (res.rowCount ?? 0) > 0;
  });
}

export async function markShopActiveFromInstall(
  shopName: string,
): Promise<boolean> {
  const name = shopName.trim().toLowerCase();
  if (!name) return false;
  return withPlatformAdmin(async (client) => {
    const res = await query(
      client,
      `update shops
       set status = case
             when status in ('uninstalled', 'suspended', 'needs_reauth') then 'active'
             else status
           end,
           updated_at = now()
       where lower(shoprenter_shop_name) = $1`,
      [name],
    );
    return (res.rowCount ?? 0) > 0;
  });
}
