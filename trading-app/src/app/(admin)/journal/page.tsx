import Link from "next/link"
import { TradeTable } from "@/components/journal/TradeTable"
import { formatR } from "@/lib/format"
import { getAllTrades } from "@/lib/data"

export const metadata = { title: "Journal" }

export default async function JournalPage() {
  const trades = await getAllTrades()
  const executed = trades.filter((t) => t.setupType !== "skip")
  const netR = executed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0)
  const wins = executed.filter((t) => t.result === "win").length
  const decided = executed.filter((t) => t.result != null && t.result !== "be").length

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Trade Journal</h1>
          <p className="mt-1 text-sm text-muted">
            {executed.length} trade + {trades.length - executed.length} logolt
            skip · nettó <span className="num">{formatR(netR)}</span> · win rate{" "}
            <span className="num">
              {decided > 0 ? Math.round((wins / decided) * 100) : 0}%
            </span>
          </p>
        </div>
        <Link
          href="/journal/new"
          className="rounded-md bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
        >
          + Új trade
        </Link>
      </header>

      {trades.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            Még nincs rögzített trade. A session után itt rögzítsd az összeset —
            a skip-eket is.
          </p>
          <Link
            href="/journal/new"
            className="mt-4 inline-block rounded-md bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/25"
          >
            Első trade rögzítése
          </Link>
        </div>
      ) : (
        <TradeTable trades={trades} />
      )}
    </div>
  )
}
