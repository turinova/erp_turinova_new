import type { PoolClient } from "pg";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { query, withPlatformAdmin } from "@/lib/db";
import {
  DEFAULT_WIDGET_SETTINGS,
  normalizeWidgetSettings,
  resolvePublicWidgetConfig,
  type PublicWidgetConfig,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";

/** Bump together with injected CSS id in public/widget.js (sr-b2b-qo-panel-css-vN). */
export const WIDGET_JS_ASSET = "33";

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
};

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
       w.updated_at as settings_updated_at
     from shops s
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
  return {
    shopId: row.shop_id,
    publicId: row.public_id,
    widgetEnabled: row.widget_enabled,
    buttonLabel: row.button_label ?? "Gyors rendelés",
    customerGroupIds: [],
    settings: normalizeWidgetSettings(row.settings ?? {}),
    storeUrl: row.store_url,
    shoprenterShopName: row.shoprenter_shop_name,
    status: row.status,
    catalogStatus: row.catalog_status ?? "pending",
    catalogReady: catalogIsSearchable(row.catalog_status),
    widgetVersion: widgetCacheBust({
      settingsUpdatedAt: toIso(row.settings_updated_at),
      catalogSyncedAt: toIso(row.catalog_synced_at),
    }),
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
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
  const nextSettings =
    input.settings !== undefined
      ? normalizeWidgetSettings(input.settings)
      : normalizeWidgetSettings(row.settings ?? {});

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
    }>(
      client,
      `select
         s.widget_enabled,
         s.status,
         s.catalog_status,
         w.button_label,
         w.settings
       from shops s
       left join widget_settings w on w.shop_id = s.id
       where s.public_id = $1
       limit 1`,
      [publicId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const catalogStatus = row.catalog_status ?? "pending";
    const catalogReady = catalogIsSearchable(catalogStatus);
    // allowedGroupIds always [] → everyone (see widget.js groupAllowed)
    if (row.status === "suspended" || row.status === "uninstalled") {
      return {
        ...resolvePublicWidgetConfig({
          enabled: false,
          buttonLabel: row.button_label ?? "Gyors rendelés",
          allowedGroupIds: [],
          settings: row.settings ?? DEFAULT_WIDGET_SETTINGS,
        }),
        catalogStatus,
        catalogReady: false,
      };
    }
    return {
      ...resolvePublicWidgetConfig({
        enabled: row.widget_enabled,
        buttonLabel: row.button_label ?? "Gyors rendelés",
        allowedGroupIds: [],
        settings: row.settings ?? DEFAULT_WIDGET_SETTINGS,
      }),
      catalogStatus,
      catalogReady,
    };
  });
}
