import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppSettings, AppSettingsInput } from "@/types/app-settings"
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings/default-app-settings"
import { fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"
import {
  appSettingsInputToRow,
  mapAppSettingsRow,
  ORGANIZATION_APP_SETTINGS_SELECT,
  type OrganizationAppSettingsRow,
} from "@/lib/app-settings/app-settings-map"
import { normalizeAppSettings } from "@/lib/app-settings/normalize-app-settings"

async function tradeCodesForOrg(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const trades = await fetchOrgTrades(supabase, organizationId)
  return trades.map((t) => t.code)
}

export async function fetchOrgAppSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AppSettings> {
  const tradeCodes = await tradeCodesForOrg(supabase, organizationId)

  const { data, error } = await supabase
    .from("organization_app_settings")
    .select(ORGANIZATION_APP_SETTINGS_SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle<OrganizationAppSettingsRow>()

  if (error) throw error
  if (!data) return normalizeAppSettings(DEFAULT_APP_SETTINGS, tradeCodes)
  return mapAppSettingsRow(data, tradeCodes)
}

export async function upsertOrgAppSettings(
  supabase: SupabaseClient,
  organizationId: string,
  input: AppSettingsInput
): Promise<AppSettings> {
  const tradeCodes = await tradeCodesForOrg(supabase, organizationId)
  const row = appSettingsInputToRow(organizationId, input)

  const { data, error } = await supabase
    .from("organization_app_settings")
    .upsert(row, { onConflict: "organization_id" })
    .select(ORGANIZATION_APP_SETTINGS_SELECT)
    .single<OrganizationAppSettingsRow>()

  if (error || !data) throw error ?? new Error("Mentés sikertelen.")
  return mapAppSettingsRow(data, tradeCodes)
}
