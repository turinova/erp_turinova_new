import { SettingsForm } from "@/components/settings/SettingsForm"
import { getSettings } from "@/lib/data"
import { DEFAULT_SETTINGS } from "@/lib/types"

export const metadata = { title: "Beállítások" }

export default async function SettingsPage() {
  const settings = (await getSettings()) ?? DEFAULT_SETTINGS

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Beállítások</h1>
        <p className="mt-1 text-sm text-muted">
          Kockázati szabályok — ezek hajtják a guardraileket és a
          méretkalkulátort.
        </p>
      </header>

      <SettingsForm initial={settings} />
    </div>
  )
}
