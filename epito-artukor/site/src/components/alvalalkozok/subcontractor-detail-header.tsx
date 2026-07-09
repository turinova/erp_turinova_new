import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"
import type { Subcontractor } from "@/types/subcontractors"
import { getTradeLabel } from "@/lib/trades"
import {
  SubcontractorStatusBadge,
  SubcontractorTierBadge,
} from "@/components/alvalalkozok/subcontractor-badges"
import { Button } from "@/components/ui/button"

function cityFromAddress(address?: string): string | null {
  if (!address?.trim()) return null
  const match = address.match(/\d{4}\s+([^,]+)/)
  return match?.[1]?.trim() ?? null
}

type SubcontractorDetailHeaderProps = {
  sub: Subcontractor
  onEdit: () => void
}

export function SubcontractorDetailHeader({ sub, onEdit }: SubcontractorDetailHeaderProps) {
  const city = cityFromAddress(sub.address)
  const tradeLabels = sub.trades.map((t) => getTradeLabel(t)).join(", ")

  const metaParts = [
    sub.legalName,
    tradeLabels || null,
    city,
  ].filter(Boolean)

  return (
    <header className="mb-4">
      <Link
        href="/alvalalkozok"
        className="mb-3 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Alvállalkozók
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-8 w-1 shrink-0 rounded-full bg-[var(--page-accent)]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-3xl">
              {sub.displayName}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base">
              <span className="font-code font-semibold text-blue-700">{sub.code}</span>
              {metaParts.length > 0 ? (
                <>
                  {metaParts.map((part) => (
                    <span key={part}>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-medium text-slate-800">{part}</span>
                    </span>
                  ))}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Szerkesztés
          </Button>
          <SubcontractorTierBadge tier={sub.tier} className="text-xs font-semibold" />
          <SubcontractorStatusBadge status={sub.status} className="text-xs font-semibold" />
        </div>
      </div>

      {sub.status === "blocked" ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Tiltott partner — RFQ meghíváskor figyelmeztetés jelenik meg.
        </p>
      ) : null}
    </header>
  )
}
