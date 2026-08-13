import { createSupabaseServer } from "@/lib/supabase/server"
import { CRYPTO_KIND_LABEL } from "@/lib/crypto/types"
import { SignalsBankrollViz } from "@/components/crypto/SignalsBankrollViz"
import { describePaperCostModel, PAPER_EVAL_VERSION } from "@/lib/crypto/paper"
import type { SimTradeInput } from "@/lib/crypto/bankroll-sim"

export const metadata = { title: "Crypto signalok" }

interface CryptoSignalRow {
  id: string
  date: string
  symbol: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  target: number
  reason: string | null
  btc_regime: string | null
  funding_rate: number | null
  rvol: number | null
  source: string
  status: "open" | "win" | "loss" | "expired"
  exit_price: number | null
  exited_at: string | null
  r_multiple: number | null
  r_multiple_gross: number | null
  fees_r: number | null
  slippage_r: number | null
  exit_reason: string | null
  partial: boolean | null
  eval_version: string | null
  oi_delta_1h: number | null
  catalyst_mode: boolean | null
  settlement_freeze: boolean | null
  context_note: string | null
}

const SETUP_FAMILY: Record<string, string> = {
  SWEEP_LONG: "Sweep-reclaim",
  SWEEP_SHORT: "Sweep-reclaim",
  MR_LONG: "VWAP mean reversion",
  MR_SHORT: "VWAP mean reversion",
  BREAKOUT_LONG: "Session breakout",
  BREAKOUT_SHORT: "Session breakout",
  PB_LONG: "Momentum pullback",
  PB_SHORT: "Momentum pullback",
  FVG_LONG: "FVG tap",
  FVG_SHORT: "FVG tap",
}

const STATUS_LABEL: Record<CryptoSignalRow["status"], string> = {
  open: "Nyitva",
  win: "Win",
  loss: "Loss",
  expired: "Lejárt (12h)",
}

const STATUS_STYLE: Record<CryptoSignalRow["status"], string> = {
  open: "bg-sky-500/15 text-accent",
  win: "bg-emerald-500/15 text-win",
  loss: "bg-red-500/15 text-loss",
  expired: "bg-zinc-500/15 text-muted",
}

const EXIT_LABEL: Record<string, string> = {
  stop: "SL",
  tp2_full: "TP2",
  gap_target: "Gap→TP",
  tp1_then_be: "TP1→BE",
  tp1_then_tp2: "TP1→TP2",
  tp1_then_expire: "TP1→exp",
  expire: "Expire",
  data_gap: "Data gap",
  target_lt_1r: "TP (<1R)",
}

export default async function CryptoSignalsPage() {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from("crypto_signals")
    .select("*")
    .order("date", { ascending: false })
    .order("bar_time", { ascending: false })

  const signals = (data ?? []) as CryptoSignalRow[]
  const closed = signals.filter((s) => s.status !== "open" && s.r_multiple != null)
  const wins = closed.filter((s) => (s.r_multiple ?? 0) > 0)
  const netR = closed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)
  const grossR = closed.reduce(
    (sum, s) => sum + Number(s.r_multiple_gross ?? s.r_multiple ?? 0),
    0
  )
  const costDragR = grossR - netR
  const openStuck = signals.filter((s) => {
    if (s.status !== "open") return false
    const ageH = (Date.now() - new Date(s.bar_time).getTime()) / 3600_000
    return ageH >= 12
  })
  const v2Count = closed.filter((s) => s.eval_version === PAPER_EVAL_VERSION).length

  const catalystClosed = closed.filter((s) => s.catalyst_mode)
  const catalystNetR = catalystClosed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)
  const plainClosed = closed.filter((s) => !s.catalyst_mode)
  const plainNetR = plainClosed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const weekClosed = closed.filter((s) => s.date >= weekAgo)
  const weekNetR = weekClosed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)

  const groups = new Map<string, { total: number; closed: number; wins: number; netR: number }>()
  for (const s of signals) {
    const key = `${s.symbol} · ${SETUP_FAMILY[s.kind] ?? s.kind}`
    const agg = groups.get(key) ?? { total: 0, closed: 0, wins: 0, netR: 0 }
    agg.total++
    if (s.status !== "open" && s.r_multiple != null) {
      agg.closed++
      if (Number(s.r_multiple) > 0) agg.wins++
      agg.netR += Number(s.r_multiple)
    }
    groups.set(key, agg)
  }

  const simTrades: SimTradeInput[] = closed.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    kind: s.kind,
    bar_time: s.bar_time,
    entry: Number(s.entry),
    stop: Number(s.stop),
    r_multiple: Number(s.r_multiple),
    r_multiple_gross: s.r_multiple_gross != null ? Number(s.r_multiple_gross) : null,
    status: s.status,
    exited_at: s.exited_at,
  }))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Crypto napló — paper edge</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Nettó R = bruttó OHLC − fee/slip ({PAPER_EVAL_VERSION}). Exit: 50% @ 1R → BE → runner @
          2R. Konzervatív same-bar (stop elsőbbség). Ez auditálható paper — nem élő Binance
          statement.
        </p>
      </header>

      <section className="rounded-lg border border-line bg-surface-2/50 px-4 py-3 text-xs text-muted">
        <p className="font-medium text-foreground/80">Fill modell</p>
        <p className="mt-0.5">{describePaperCostModel()}</p>
        <p className="mt-1">
          Lezárt paper-v2: {v2Count}/{closed.length}
          {closed.length > 0 && costDragR > 0
            ? ` · költség drag ≈ −${costDragR.toFixed(2)}R (gross ${grossR >= 0 ? "+" : ""}${grossR.toFixed(2)} → net ${netR >= 0 ? "+" : ""}${netR.toFixed(2)})`
            : ""}
          .
        </p>
        <p className="mt-1 text-[11px]">
          SQL audit oszlopokhoz futtasd:{" "}
          <code className="rounded bg-surface px-1">sql/008_crypto_paper_audit.sql</code>
        </p>
      </section>

      {error && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-warn">
          Nem sikerült betölteni a signalokat — futtattad már a{" "}
          <code className="rounded bg-surface-2 px-1">sql/004_crypto_signals.sql</code>{" "}
          scriptet a Supabase-ben?
        </section>
      )}

      {openStuck.length > 0 && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-warn">
          {openStuck.length} open signal &gt;12h — hiányzó bar / data gap (a következő tick
          data_gap-ként zárhatja).
        </section>
      )}

      <SignalsBankrollViz
        trades={simTrades}
        paperNetR={netR}
        winCount={wins.length}
        closedCount={closed.length}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Összes signal" value={String(signals.length)} />
        <StatCard label="Lezárt" value={String(closed.length)} />
        <StatCard
          label="Win rate (net R>0)"
          value={closed.length ? `${Math.round((wins.length / closed.length) * 100)}%` : "—"}
        />
        <StatCard
          label="Nettó R"
          value={closed.length ? `${netR >= 0 ? "+" : ""}${netR.toFixed(2)}R` : "—"}
          tone={netR > 0 ? "pos" : netR < 0 ? "neg" : undefined}
        />
        <StatCard
          label="Bruttó R"
          value={closed.length ? `${grossR >= 0 ? "+" : ""}${grossR.toFixed(2)}R` : "—"}
          tone={grossR > 0 ? "pos" : grossR < 0 ? "neg" : undefined}
        />
        <StatCard
          label="Költség drag"
          value={closed.length && costDragR > 0 ? `−${costDragR.toFixed(2)}R` : "—"}
          tone={costDragR > 0 ? "neg" : undefined}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Katalizátoros"
          value={
            catalystClosed.length
              ? `${catalystNetR >= 0 ? "+" : ""}${catalystNetR.toFixed(2)}R (${catalystClosed.length})`
              : "—"
          }
          tone={catalystNetR > 0 ? "pos" : catalystNetR < 0 ? "neg" : undefined}
        />
        <StatCard
          label="Katalizátor nélkül"
          value={
            plainClosed.length
              ? `${plainNetR >= 0 ? "+" : ""}${plainNetR.toFixed(2)}R (${plainClosed.length})`
              : "—"
          }
          tone={plainNetR > 0 ? "pos" : plainNetR < 0 ? "neg" : undefined}
        />
        <StatCard
          label="7 nap nettó"
          value={
            weekClosed.length
              ? `${weekNetR >= 0 ? "+" : ""}${weekNetR.toFixed(2)}R (${weekClosed.length})`
              : "—"
          }
          tone={weekNetR > 0 ? "pos" : weekNetR < 0 ? "neg" : undefined}
        />
      </section>

      {groups.size > 0 && (
        <section className="overflow-x-auto rounded-lg border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
            Coin + setup bontás — nettó R
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Coin · setup</th>
                <th className="px-4 py-2.5 font-medium">Signal</th>
                <th className="px-4 py-2.5 font-medium">Lezárt</th>
                <th className="px-4 py-2.5 font-medium">Win rate</th>
                <th className="px-4 py-2.5 font-medium">Nettó R</th>
                <th className="px-4 py-2.5 font-medium">Átlag R</th>
              </tr>
            </thead>
            <tbody>
              {[...groups.entries()]
                .sort((a, b) => b[1].netR - a[1].netR)
                .map(([key, agg]) => (
                  <tr key={key} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5">{key}</td>
                    <td className="num px-4 py-2.5">{agg.total}</td>
                    <td className="num px-4 py-2.5">{agg.closed}</td>
                    <td className="num px-4 py-2.5">
                      {agg.closed ? `${Math.round((agg.wins / agg.closed) * 100)}%` : "—"}
                    </td>
                    <td
                      className={`num px-4 py-2.5 ${
                        agg.netR > 0 ? "text-win" : agg.netR < 0 ? "text-loss" : ""
                      }`}
                    >
                      {agg.closed ? `${agg.netR >= 0 ? "+" : ""}${agg.netR.toFixed(2)}` : "—"}
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
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Összes signal</h2>
        {signals.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            Még nincs rögzített crypto signal. Az első élő signal a Crypto live
            oldalról (vagy a 24/7 cronból) automatikusan bekerül ide.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Dátum</th>
                <th className="px-4 py-3 font-medium">Coin</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium">Entry</th>
                <th className="px-4 py-3 font-medium">Exit</th>
                <th className="px-4 py-3 font-medium">Ok</th>
                <th className="px-4 py-3 font-medium">Gross R</th>
                <th className="px-4 py-3 font-medium">Net R</th>
                <th className="px-4 py-3 font-medium">OI 1h</th>
                <th className="px-4 py-3 font-medium">BTC</th>
                <th className="px-4 py-3 font-medium">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-line/50 last:border-0">
                  <td className="num px-4 py-3">{s.date}</td>
                  <td className="px-4 py-3 font-medium">{s.symbol}</td>
                  <td className="px-4 py-3">{CRYPTO_KIND_LABEL[s.kind] ?? s.kind}</td>
                  <td className="num px-4 py-3">{fmt(s.entry)}</td>
                  <td className="num px-4 py-3">{fmt(s.exit_price)}</td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {s.exit_reason ? EXIT_LABEL[s.exit_reason] ?? s.exit_reason : "—"}
                    {s.partial ? " ·½" : ""}
                  </td>
                  <td className="num px-4 py-3 text-xs text-muted">
                    {s.r_multiple_gross != null
                      ? `${Number(s.r_multiple_gross) >= 0 ? "+" : ""}${Number(s.r_multiple_gross).toFixed(2)}`
                      : "—"}
                  </td>
                  <td
                    className={`num px-4 py-3 ${
                      s.r_multiple == null
                        ? ""
                        : Number(s.r_multiple) > 0
                          ? "text-win"
                          : Number(s.r_multiple) < 0
                            ? "text-loss"
                            : ""
                    }`}
                  >
                    {s.r_multiple != null
                      ? `${Number(s.r_multiple) >= 0 ? "+" : ""}${Number(s.r_multiple).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="num px-4 py-3 text-xs">
                    {s.oi_delta_1h != null
                      ? `${Number(s.oi_delta_1h) >= 0 ? "+" : ""}${Number(s.oi_delta_1h).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{s.btc_regime ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}
                    >
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
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
  if (n == null) return "—"
  const v = Number(n)
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 })
  if (v >= 100) return v.toFixed(2)
  if (v >= 1) return v.toFixed(3)
  return v.toFixed(5)
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
          tone === "pos" ? "text-win" : tone === "neg" ? "text-loss" : ""
        }`}
      >
        {value}
      </div>
    </div>
  )
}
