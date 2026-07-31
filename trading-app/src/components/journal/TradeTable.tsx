import { formatDateHu, formatPrice, formatR, formatTimeEt } from "@/lib/format"
import { SETUP_LABELS, type Trade } from "@/lib/types"

export function TradeTable({ trades }: { trades: Trade[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">Dátum</th>
            <th className="px-4 py-3 font-medium">Setup</th>
            <th className="num px-4 py-3 text-right font-medium">Entry</th>
            <th className="num px-4 py-3 text-right font-medium">Stop</th>
            <th className="num px-4 py-3 text-right font-medium">Exit</th>
            <th className="num px-4 py-3 text-right font-medium">R</th>
            <th className="px-4 py-3 text-center font-medium">Terv</th>
            <th className="px-4 py-3 font-medium">Megjegyzés</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr
              key={t.id}
              className="border-b border-line last:border-b-0 hover:bg-surface-2/50"
            >
              <td className="whitespace-nowrap px-4 py-3">
                <span>{formatDateHu(t.tradedAt)}</span>
                <span className="num ml-2 text-xs text-muted">
                  {formatTimeEt(t.tradedAt)} ET
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <SetupBadge trade={t} />
              </td>
              <td className="num px-4 py-3 text-right">{formatPrice(t.entryPrice)}</td>
              <td className="num px-4 py-3 text-right">{formatPrice(t.stopPrice)}</td>
              <td className="num px-4 py-3 text-right">{formatPrice(t.exitPrice)}</td>
              <td className="px-4 py-3 text-right">
                <RBadge r={t.rMultiple} />
              </td>
              <td className="px-4 py-3 text-center">
                {t.setupType === "skip" ? (
                  <span className="text-muted">—</span>
                ) : t.followedPlan ? (
                  <span title="Terv szerint" className="text-win">✓</span>
                ) : (
                  <span title="Szabályszegés" className="text-loss">✗</span>
                )}
              </td>
              <td className="max-w-72 truncate px-4 py-3 text-muted" title={t.notes ?? ""}>
                {t.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SetupBadge({ trade }: { trade: Trade }) {
  const isSkip = trade.setupType === "skip"
  const isShort =
    trade.setupType === "orb_short" ||
    (trade.entryPrice != null &&
      trade.stopPrice != null &&
      trade.stopPrice > trade.entryPrice)

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isSkip
          ? "bg-surface-2 text-muted"
          : isShort
            ? "bg-loss/15 text-loss"
            : "bg-win/15 text-win"
      }`}
    >
      {SETUP_LABELS[trade.setupType]}
    </span>
  )
}

export function RBadge({ r }: { r: number | null }) {
  if (r == null) return <span className="text-muted">—</span>
  return (
    <span
      className={`num font-semibold ${
        r > 0 ? "text-win" : r < 0 ? "text-loss" : "text-muted"
      }`}
    >
      {formatR(r)}
    </span>
  )
}
