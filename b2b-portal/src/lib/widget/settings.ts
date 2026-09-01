import type { PoolClient } from "pg";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { query, withPlatformAdmin } from "@/lib/db";
import {
  canHideTurinovaMark,
  canParseImage,
  parsePlanId,
  PLAN_DEFAULTS,
  resolveShowTurinovaMark,
} from "@/lib/billing/plans";
import { isTrialActive } from "@/lib/orgs/health";
import {
  DEFAULT_WIDGET_SETTINGS,
  normalizeWidgetSettings,
  resolveFreeShippingPublic,
  resolvePublicWidgetConfig,
  type PublicFreeShipping,
  type PublicWidgetConfig,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

export { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

export function widgetCacheBust(opts: {
  settingsUpdatedAt: string | null;
  catalogSyncedAt: string | null;
}): string {
  const a = opts.settingsUpdatedAt ? Date.parse(opts.settingsUpdatedAt) || 0 : 0;
  const b = opts.catalogSyncedAt ? Date.parse(opts.catalogSyncedAt) || 0 : 0;
  return `${WIDGET_JS_ASSET}.${Math.max(a, b) || 0}`;
}

export type MerchantWidgetDto = {
  shopId: string;
  publicId: string;
  widgetEnabled: boolean;
  buttonLabel: string;
  /** Always empty — gomb mindenkinek; mező a DB kompatibilitás miatt marad */
  customerGroupIds: number[];
  settings: WidgetSettingsPayload;
  storeUrl: string | null;
  shoprenterShopName: string;
  status: string;
  catalogStatus: string;
  catalogReady: boolean;
  /** Query on /widget.js so Shoprenter/HTML caches pick up new JS. */
  widgetVersion: string;
  canHideTurinovaMark: boolean;
  canParseImage: boolean;
  isTrial: boolean;
  planLabel: string;
  /** Resolved FOMO payload (same shape as public config). */
  freeShippingResolved: PublicFreeShipping | null;
};

type WidgetRow = {
  shop_id: string;
  public_id: string;
  widget_enabled: boolean;
  store_url: string | null;
  shoprenter_shop_name: string;
  status: string;
  catalog_status: string | null;
  catalog_synced_at: Date | string | null;
  button_label: string | null;
  customer_group_ids: number[] | null;
  settings: unknown;
  settings_updated_at: Date | string | null;
  org_plan: string | null;
  org_status: string | null;
  trial_ends_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function orgWidgetBranding(row: {
  org_plan: string | null;
  org_status: string | null;
  trial_ends_at: Date | string | null;
  hideRequested: boolean;
}) {
  const plan = parsePlanId(row.org_plan);
  const isTrial = isTrialActive(row.org_status ?? "", toIso(row.trial_ends_at));
  return {
    plan,
    isTrial,
    canHideTurinovaMark: canHideTurinovaMark(plan, isTrial),
    canParseImage: canParseImage(plan, isTrial),
    planLabel: PLAN_DEFAULTS[plan].label,
    showTurinovaMark: resolveShowTurinovaMark({
      hideRequested: row.hideRequested,
      plan,
      isTrial,
    }),
  };
}

async function loadWidgetRow(
  client: PoolClient,
  orgId: string,
): Promise<WidgetRow | null> {
  const res = await query<WidgetRow>(
    client,
    `select
       s.id as shop_id,
       s.public_id,
       s.widget_enabled,
       s.store_url,
       s.shoprenter_shop_name,
       s.status,
       s.catalog_status,
       s.catalog_synced_at,
       w.button_label,
       w.customer_group_ids,
       w.settings,
       w.updated_at as settings_updated_at,
       o.plan as org_plan,
       o.status as org_status,
       o.trial_ends_at
     from shops s
     join organizations o on o.id = s.organization_id
     left join widget_settings w on w.shop_id = s.id
     where s.organization_id = $1
     order by s.created_at
     limit 1`,
    [orgId],
  );
  return res.rows[0] ?? null;
}

export async function loadMerchantWidget(
  client: PoolClient,
  orgId: string,
): Promise<MerchantWidgetDto | null> {
  const row = await loadWidgetRow(client, orgId);
  if (!row) return null;
  const settings = normalizeWidgetSettings(row.settings ?? {});
  const branding = orgWidgetBranding({
    org_plan: row.org_plan,
    org_status: row.org_status,
    trial_ends_at: row.trial_ends_at,
    hideRequested: settings.features.hideTurinovaMark,
  });
  return {
    shopId: row.shop_id,
    publicId: row.public_id,
    widgetEnabled: row.widget_enabled,
    buttonLabel: row.button_label ?? "Gyors rendelés",
    customerGroupIds: [],
    settings,
    storeUrl: row.store_url,
    shoprenterShopName: row.shoprenter_shop_name,
    status: row.status,
    catalogStatus: row.catalog_status ?? "pending",
    catalogReady: catalogIsSearchable(row.catalog_status),
    widgetVersion: widgetCacheBust({
      settingsUpdatedAt: toIso(row.settings_updated_at),
      catalogSyncedAt: toIso(row.catalog_synced_at),
    }),
    canHideTurinovaMark: branding.canHideTurinovaMark,
    canParseImage: branding.canParseImage,
    isTrial: branding.isTrial,
    planLabel: branding.planLabel,
    freeShippingResolved: resolveFreeShippingPublic({ settings }),
  };
}

export type UpdateWidgetInput = {
  widgetEnabled?: boolean;
  buttonLabel?: string;
  /** Ignored — gomb mindenkinek */
  customerGroupIds?: number[];
  settings?: WidgetSettingsPayload;
};

export async function updateMerchantWidget(
  client: PoolClient,
  orgId: string,
  userId: string,
  input: UpdateWidgetInput,
): Promise<MerchantWidgetDto> {
  const row = await loadWidgetRow(client, orgId);
  if (!row) throw new Error("NO_SHOP");

  if (input.widgetEnabled !== undefined) {
    await query(
      client,
      `update shops set widget_enabled = $1, updated_at = now() where id = $2`,
      [Boolean(input.widgetEnabled), row.shop_id],
    );
  }

  const nextLabel =
    input.buttonLabel !== undefined
      ? input.buttonLabel.trim() || "Gyors rendelés"
      : row.button_label ?? "Gyors rendelés";
  // Always empty = everyone sees the button (widget.js)
  const nextGroups: number[] = [];
  let nextSettings =
    input.settings !== undefined
      ? normalizeWidgetSettings(input.settings)
      : normalizeWidgetSettings(row.settings ?? {});

  const brandingGate = orgWidgetBranding({
    org_plan: row.org_plan,
    org_status: row.org_status,
    trial_ends_at: row.trial_ends_at,
    hideRequested: nextSettings.features.hideTurinovaMark,
  });
  // Plan drives mark: paid white-label → always hide; trial/start → always show.
  nextSettings = {
    ...nextSettings,
    features: {
      ...nextSettings.features,
      hideTurinovaMark: brandingGate.canHideTurinovaMark,
    },
  };

  await query(
    client,
    `insert into widget_settings (shop_id, button_label, customer_group_ids, settings)
     values ($1, $2, $3, $4::jsonb)
     on conflict (shop_id) do update set
       button_label = excluded.button_label,
       customer_group_ids = excluded.customer_group_ids,
       settings = excluded.settings,
       updated_at = now()`,
    [row.shop_id, nextLabel, nextGroups, JSON.stringify(nextSettings)],
  );

  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, 'widget.settings_updated', $3::jsonb)`,
    [
      orgId,
      userId,
      JSON.stringify({
        fabColorPreset: nextSettings.appearance.fabColorPreset,
        fabPosition: nextSettings.appearance.fabPosition,
      }),
    ],
  );

  const dto = await loadMerchantWidget(client, orgId);
  if (!dto) throw new Error("NO_SHOP");
  return dto;
}

export async function loadPublicWidgetConfig(
  publicId: string,
): Promise<PublicWidgetConfig | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<{
      widget_enabled: boolean;
      button_label: string | null;
      settings: unknown;
      status: string;
      catalog_status: string | null;
      org_plan: string | null;
      org_status: string | null;
      trial_ends_at: Date | string | null;
    }>(
      client,
      `select
         s.widget_enabled,
         s.status,
         s.catalog_status,
         w.button_label,
         w.settings,
         o.plan as org_plan,
         o.status as org_status,
         o.trial_ends_at
       from shops s
       join organizations o on o.id = s.organization_id
       left join widget_settings w on w.shop_id = s.id
       where s.public_id = $1
       limit 1`,
      [publicId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const catalogStatus = row.catalog_status ?? "pending";
    const catalogReady = catalogIsSearchable(catalogStatus);
    const settings = row.settings ?? DEFAULT_WIDGET_SETTINGS;
    const normalized = normalizeWidgetSettings(settings);
    const branding = orgWidgetBranding({
      org_plan: row.org_plan,
      org_status: row.org_status,
      trial_ends_at: row.trial_ends_at,
      hideRequested: normalized.features.hideTurinovaMark,
    });
    const disabled =
      row.status === "suspended" || row.status === "uninstalled";
    const publicCfg = resolvePublicWidgetConfig({
      enabled: disabled ? false : row.widget_enabled,
      buttonLabel: row.button_label ?? "Gyors rendelés",
      allowedGroupIds: [],
      settings,
    });
    if (!branding.canParseImage) {
      publicCfg.modules = publicCfg.modules.filter((m) => m !== "image");
    }
    return {
      ...publicCfg,
      catalogStatus,
      catalogReady: disabled ? false : catalogReady,
      showTurinovaMark: branding.showTurinovaMark,
    };
  });
}
