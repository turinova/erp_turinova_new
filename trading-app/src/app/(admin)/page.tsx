import Link from "next/link"
import { PreSessionChecklist } from "@/components/dashboard/PreSessionChecklist"
import { formatR } from "@/lib/format"
import {
  getAllTrades,
  getSettings,
  getTodayEtDate,
  getTodaySession,
  getTradesForDate,
} from "@/lib/data"
import { DEFAULT_SETTINGS } from "@/lib/types"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [settingsRow, today, todayAllTrades, allTrades] = await Promise.all([
    getSettings(),
    getTodaySession(),
    getTradesForDate(getTodayEtDate()),
    getAllTrades(),
  ])
  const settings = settingsRow ?? DEFAULT_SETTINGS

  const todayTrades = todayAllTrades.filter((t) => t.setupType !== "skip")
  const todayR = todayTrades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0)
  const guardrailHit = todayR <= -settings.maxDailyLossR
  const tradesMaxed = todayTrades.length >= settings.maxTradesPerDay

  const executed = allTrades.filter((t) => t.setupType !== "skip")
  const netR = executed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          {new Date(getTodayEtDate()).toLocaleDateString("hu-HU", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}{" "}
          · MNQ session 15:30–17:00 (magyar idő)
        </p>
      </header>

      {guardrailHit && (
        <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm font-medium text-loss">
          Napi -{settings.maxDailyLossR}R elérve — ma már nem tradelsz. Zárd le
          a platformot.
        </div>
      )}
      {!guardrailHit && tradesMaxed && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-medium text-warn">
          Napi trade-limit ({settings.maxTradesPerDay}) elérve — mára ennyi
          volt.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Mai trade"
          value={`${todayTrades.length}/${settings.maxTradesPerDay}`}
          tone={tradesMaxed ? "warn" : "default"}
        />
        <StatCard
          label="Mai R"
          value={formatR(todayR)}
          tone={todayR > 0 ? "win" : todayR < 0 ? "loss" : "default"}
          sub={`Napi stop: -${settings.maxDailyLossR}R`}
        />
        <StatCard
          label="Össz. nettó R (demo)"
          value={formatR(netR)}
          tone={netR > 0 ? "win" : netR < 0 ? "loss" : "default"}
          sub={`${executed.length} trade`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PreSessionChecklist />

        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold">Mai session állapot</h2>
          {today?.orbLockedAt ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                ORB rögzítve:{" "}
                <span className="num text-foreground">
                  {today.orbHigh} / {today.orbLow}
                </span>
              </p>
              <Link
                href="/session"
                className="inline-flex items-center gap-2 rounded-md bg-accent/15 px-3.5 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Session megnyitása →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Az ORB még nincs rögzítve. A session 15:30-kor (magyar idő)
                nyit, az ORB-t 15:45-kor tudod lockolni.
              </p>
              {today && (today.overnightHigh != null || today.overnightLow != null) && (
                <div className="num rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
                  Overnight high/low:{" "}
                  <span className="text-foreground">
                    {today.overnightHigh ?? "—"} / {today.overnightLow ?? "—"}
                  </span>
                </div>
              )}
              <Link
                href="/session"
                className="inline-flex items-center gap-2 rounded-md bg-accent/15 px-3.5 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
              >
                Session megnyitása →
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  tone?: "default" | "win" | "loss" | "warn"
}) {
  const toneClass =
    tone === "win"
      ? "text-win"
      : tone === "loss"
        ? "text-loss"
        : tone === "warn"
          ? "text-warn"
          : "text-foreground"

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-1.5 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}
