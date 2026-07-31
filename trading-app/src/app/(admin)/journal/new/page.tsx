import Link from "next/link"
import { TradeForm } from "@/components/journal/TradeForm"
import { getSettings } from "@/lib/data"
import { DEFAULT_SETTINGS } from "@/lib/types"

export const metadata = { title: "Új trade" }

export default async function NewTradePage() {
  const settings = (await getSettings()) ?? DEFAULT_SETTINGS

  return (
    <div className="space-y-6">
      <header>
        <Link href="/journal" className="text-xs text-muted hover:text-foreground">
          ← Vissza a journalhoz
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Új trade rögzítése</h1>
        <p className="mt-1 text-sm text-muted">
          A skip-eket is rögzítsd — az edge validálásához az is adat, amikor a
          szabály miatt nem léptél be.
        </p>
      </header>

      <TradeForm settings={settings} />
    </div>
  )
}
