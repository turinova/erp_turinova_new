import type { PoolClient } from "pg";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { query } from "@/lib/db";
import { ensureMarketingProfileSchema } from "@/lib/merchant/ensure-marketing-profile-schema";
import { loadMerchantShop } from "@/lib/merchant/shop";
import {
  normalizeMarketingProfile,
  type MarketingProfile,
  type PartnerActivationDto,
} from "@/lib/merchant/partner-activation";

export async function loadPartnerActivation(
  client: PoolClient,
  orgId: string,
): Promise<PartnerActivationDto | null> {
  await ensureMarketingProfileSchema();
  const shop = await loadMerchantShop(client, orgId);
  if (!shop) return null;

  const row = await query<{
    catalog_status: string | null;
    marketing_profile: unknown;
    button_label: string | null;
  }>(
    client,
    `select s.catalog_status, s.marketing_profile,
            w.button_label
       from shops s
       left join widget_settings w on w.shop_id = s.id
      where s.id = $1
      limit 1`,
    [shop.shopId],
  );
  const data = row.rows[0];
  const catalogReady = catalogIsSearchable(data?.catalog_status ?? "pending");

  const buttonLabel = data?.button_label?.trim() || "Gyors rendelés";

  let hasPricing = false;
  try {
    const priceRes = await query<{ n: string }>(
      client,
      `select (
         (select count(*)::int from partner_group_prices where shop_id = $1) +
         (select count(*)::int from partner_volume_tiers where shop_id = $1)
       )::text as n`,
      [shop.shopId],
    );
    hasPricing = Number(priceRes.rows[0]?.n ?? 0) > 0;
  } catch {
    hasPricing = false;
  }

  let widgetOrdersMonth = 0;
  try {
    const ordRes = await query<{ n: string }>(
      client,
      `select count(*)::text as n
         from b2b_orders
        where shop_id = $1
          and source = 'widget'
          and status in ('recorded', 'linked')
          and created_at >= date_trunc('month', now())`,
      [shop.shopId],
    );
    widgetOrdersMonth = Number(ordRes.rows[0]?.n ?? 0);
  } catch {
    widgetOrdersMonth = 0;
  }

  const profile = normalizeMarketingProfile(data?.marketing_profile ?? {});

  return {
    shopName: shop.shoprenterShopName,
    shopUrl: shop.storeUrl,
    buttonLabel,
    widgetEnabled: shop.widgetEnabled,
    catalogReady,
    hasPricing,
    widgetOrdersMonth,
    profile,
  };
}

export async function saveMarketingProfile(
  client: PoolClient,
  orgId: string,
  profile: MarketingProfile,
): Promise<PartnerActivationDto | null> {
  await ensureMarketingProfileSchema();
  const shop = await loadMerchantShop(client, orgId);
  if (!shop) return null;

  await query(
    client,
    `update shops
        set marketing_profile = $2::jsonb,
            updated_at = now()
      where id = $1`,
    [shop.shopId, JSON.stringify(profile)],
  );

  return loadPartnerActivation(client, orgId);
}

export function isLaunchEmailAcknowledged(profile: MarketingProfile): boolean {
  return Boolean(profile.launchEmailAcknowledgedAt);
}
