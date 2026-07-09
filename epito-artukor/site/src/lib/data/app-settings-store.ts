import type { AppSettings, AppSettingsInput } from "@/types/app-settings"
import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings/default-app-settings"
import {
  normalizeAppSettings,
  appSettingsInputFromSettings,
} from "@/lib/app-settings/normalize-app-settings"

export { normalizeAppSettings, appSettingsInputFromSettings }

/** In-memory cache — a DB (/api/app-settings) az egyetlen forrás, a primer tölti fel. */
let appSettingsCache: AppSettings | null = null

export function loadAppSettings(): AppSettings {
  return appSettingsCache ?? normalizeAppSettings(DEFAULT_APP_SETTINGS)
}

export function cacheAppSettings(settings: AppSettings): AppSettings {
  const next = normalizeAppSettings(settings)
  appSettingsCache = next
  return next
}
