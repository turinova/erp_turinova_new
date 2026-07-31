import { createSupabaseServer } from "@/lib/supabase/server"

export const metadata = { title: "Élő signalok" }

interface SignalRow {
  id: string
  date: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  target: number
  contracts: number | null
  reason: string | null
  source: string
  status: "open" | "win" | "loss" | "expired"
  exit_price: number | null
  r_multiple: number | null
}

const KIND_LABEL: Record<string, string> = {
  ORB_LONG: "ORB Long",
  ORB_SHORT: "ORB Short",
  FADE_LONG: "Fade Long",
  FADE_SHORT: "Fade Short",
  VWAP_LONG: "VWAP Rev. Long",
  VWAP_SHORT: "VWAP Rev. Short",
  PB_LONG: "Pullback Long",
  PB_SHORT: "Pullback Short",
}

/** setup-család: ORB_LONG + ORB_SHORT → "ORB" stb. */
const SETUP_FAMILY: Record<string, string> = {
  ORB_LONG: "ORB breakout",
  ORB_SHORT: "ORB breakout",
  FADE_LONG: "Failed breakout fade",
  FADE_SHORT: "Failed breakout fade",
  VWAP_LONG: "VWAP reversion",
  VWAP_SHORT: "VWAP reversion",
  PB_LONG: "Momentum pullback",
  PB_SHORT: "Momentum pullback",
}

const STATUS_LABEL: Record<SignalRow["status"], string> = {
  open: "Nyitva",
  win: "Win",
  loss: "Loss",
  expired: "Zárás EOD",
}

const STATUS_STYLE: Record<SignalRow["status"], string> = {
  open: "bg-sky-500/15 text-sky-400",
  win: "bg-emerald-500/15 text-emerald-400",
  loss: "bg-red-500/15 text-red-400",
  expired: "bg-zinc-500/15 text-zinc-400",
}

export default async function SignalsPage() {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from("live_signals")
    .select("*")
    .order("date", { ascending: false })
    .order("bar_time", { ascending: false })

  const signals = (data ?? []) as SignalRow[]
  const closed = signals.filter((s) => s.status !== "open" && s.r_multiple != null)
  const wins = closed.filter((s) => (s.r_multiple ?? 0) > 0)
  const netR = closed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)

  // utolsó 7 nap
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const weekClosed = closed.filter((s) => s.date >= weekAgo)
  const weekNetR = weekClosed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)

  // setup-családonkénti bontás
  const families = new Map<
    string,
    { total: number; closed: number; wins: number; netR: number }
  >()
  for (const s of signals) {
    const fam = SETUP_FAMILY[s.kind] ?? s.kind
    const agg = families.get(fam) ?? { total: 0, closed: 0, wins: 0, netR: 0 }
    agg.total++
    if (s.status !== "open" && s.r_multiple != null) {
      agg.closed++
      if (Number(s.r_multiple) > 0) agg.wins++
      agg.netR += Number(s.r_multiple)
    }
    families.set(fam, agg)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Élő signalok — paper trading</h1>
        <p className="mt-1 text-sm text-muted">
          Minden élő signal automatikusan ide mentődik, és a rendszer papíron
          végigköveti: stop (-1R), 2R target vagy zárás a session végén. Így
          derül ki, hogy az élő signalok hozzák-e a backtest számait.
        </p>
      </header>

      {error && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
          Nem sikerült betölteni a signalokat — futtattad már a{" "}
          <code className="rounded bg-surface-2 px-1">sql/002_live_signals.sql</code>{" "}
          scriptet a Supabase-ben?
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Összes signal" value={String(signals.length)} />
        <StatCard label="Lezárt" value={String(closed.length)} />
        <StatCard
          label="Win rate"
          value={closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "—"}
        />
        <StatCard
          label="Nettó R (papír)"
          value={closed.length ? `${netR >= 0 ? "+" : ""}${netR.toFixed(2)}R` : "—"}
          tone={netR > 0 ? "pos" : netR < 0 ? "neg" : undefined}
        />
        <StatCard
          label="Utolsó 7 nap"
          value={
            weekClosed.length
              ? `${weekNetR >= 0 ? "+" : ""}${weekNetR.toFixed(2)}R (${weekClosed.length} db)`
              : "—"
          }
          tone={weekNetR > 0 ? "pos" : weekNetR < 0 ? "neg" : undefined}
        />
      </section>

      {families.size > 0 && (
        <section className="overflow-x-auto rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            Setup-onkénti eredmény — melyik hozza a backtest számait?
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Setup</th>
                <th className="px-4 py-2.5 font-medium">Signal</th>
                <th className="px-4 py-2.5 font-medium">Lezárt</th>
                <th className="px-4 py-2.5 font-medium">Win rate</th>
                <th className="px-4 py-2.5 font-medium">Nettó R</th>
                <th className="px-4 py-2.5 font-medium">Átlag R</th>
              </tr>
            </thead>
            <tbody>
              {[...families.entries()]
                .sort((a, b) => b[1].netR - a[1].netR)
                .map(([fam, agg]) => (
                  <tr key={fam} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5">{fam}</td>
                    <td className="num px-4 py-2.5">{agg.total}</td>
                    <td className="num px-4 py-2.5">{agg.closed}</td>
                    <td className="num px-4 py-2.5">
                      {agg.closed ? `${Math.round((agg.wins / agg.closed) * 100)}%` : "—"}
                    </td>
                    <td
                      className={`num px-4 py-2.5 ${
                        agg.netR > 0
                          ? "text-emerald-400"
                          : agg.netR < 0
                            ? "text-red-400"
                            : ""
                      }`}
                    >
                      {agg.closed
                        ? `${agg.netR >= 0 ? "+" : ""}${agg.netR.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="num px-4 py-2.5">
                      {agg.closed ? (agg.netR / agg.closed).toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        {signals.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            Még nincs rögzített signal. Az első élő signal a session oldalról
            automatikusan bekerül ide.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Dátum</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium">Entry</th>
                <th className="px-4 py-3 font-medium">Stop</th>
                <th className="px-4 py-3 font-medium">Target (2R)</th>
                <th className="px-4 py-3 font-medium">Exit</th>
                <th className="px-4 py-3 font-medium">R</th>
                <th className="px-4 py-3 font-medium">Státusz</th>
                <th className="px-4 py-3 font-medium">Forrás</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-line/50 last:border-0">
                  <td className="num px-4 py-3">{s.date}</td>
                  <td className="px-4 py-3">{KIND_LABEL[s.kind] ?? s.kind}</td>
                  <td className="num px-4 py-3">{fmt(s.entry)}</td>
                  <td className="num px-4 py-3">{fmt(s.stop)}</td>
                  <td className="num px-4 py-3">{fmt(s.target)}</td>
                  <td className="num px-4 py-3">{fmt(s.exit_price)}</td>
                  <td
                    className={`num px-4 py-3 ${
                      s.r_multiple == null
                        ? ""
                        : Number(s.r_multiple) > 0
                          ? "text-emerald-400"
                          : Number(s.r_multiple) < 0
                            ? "text-red-400"
                            : ""
                    }`}
                  >
                    {s.r_multiple != null
                      ? `${Number(s.r_multiple) >= 0 ? "+" : ""}${Number(s.r_multiple).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function fmt(n: number | null): string {
  return n != null ? Number(n).toFixed(2) : "—"
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "pos" | "neg"
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`num mt-0.5 text-lg font-semibold ${
          tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : ""
        }`}
      >
        {value}
      </div>
    </div>
  )
}
