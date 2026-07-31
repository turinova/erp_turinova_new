import { LiveSession } from "@/components/session/LiveSession"
import { OrbPanel } from "@/components/session/OrbPanel"
import { getSettings, getTodayEtDate, getTodaySession } from "@/lib/data"
import { DEFAULT_SETTINGS } from "@/lib/types"

export const metadata = { title: "Session" }

export default async function SessionPage() {
  const [settingsRow, today] = await Promise.all([
    getSettings(),
    getTodaySession(),
  ])
  const settings = settingsRow ?? DEFAULT_SETTINGS

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">MNQ Session — élő</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(getTodayEtDate()).toLocaleDateString("hu-HU", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}{" "}
          · Az ORB 9:45 ET-kor automatikusan rögzül és mentődik.
        </p>
      </header>

      <LiveSession />

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-muted hover:text-foreground">
          Kézi mód (tartalék, ha az élő feed nem elérhető)
        </summary>
        <div className="border-t border-line p-5">
          <OrbPanel initialSession={today} settings={settings} />
        </div>
      </details>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Döntési fa (emlékeztető)</h2>
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
          <li>
            Breakout + RVOL ≥ 1.2 + VWAP-egyezés →{" "}
            <span className="text-foreground">ORB entry</span>
          </li>
          <li>
            Breakout visszaesik a range-be →{" "}
            <span className="text-foreground">failed breakout fade</span>
          </li>
          <li>
            Nincs breakout, ár a VWAP körül →{" "}
            <span className="text-foreground">VWAP reversion</span> (range nap)
          </li>
          <li>
            Trend beindult, lemaradtál →{" "}
            <span className="text-foreground">momentum pullback</span>
          </li>
          <li>
            Minden entry előtt: volt liquidity sweep? Van FVG? (ICT kontextus)
          </li>
        </ol>
      </section>
    </div>
  )
}
