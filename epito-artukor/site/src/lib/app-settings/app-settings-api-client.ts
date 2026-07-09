import type { AppSettings, AppSettingsInput } from "@/types/app-settings"

export async function fetchAppSettingsFromApi(): Promise<{
  settings?: AppSettings
  error?: string
}> {
  const res = await fetch("/api/app-settings")
  const data = (await res.json()) as { settings?: AppSettings; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Nem sikerült betölteni a beállításokat." }
  }
  return { settings: data.settings }
}

export async function saveAppSettingsToApi(
  input: AppSettingsInput
): Promise<{ settings?: AppSettings; error?: string }> {
  const res = await fetch("/api/app-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const data = (await res.json()) as { settings?: AppSettings; error?: string }
  if (!res.ok) {
    return { error: data.error ?? "Mentés sikertelen." }
  }
  return { settings: data.settings }
}
