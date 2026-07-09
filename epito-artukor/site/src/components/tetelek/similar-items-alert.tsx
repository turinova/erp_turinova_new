import type { CostItem } from "@/types"
import { formatHuf } from "@/lib/pricing"
import { Button } from "@/components/ui/button"

type SimilarItemsAlertProps = {
  similar: Array<{ item: CostItem; score: number }>
  onOpenExisting: (item: CostItem) => void
  onContinue: () => void
}

export function SimilarItemsAlert({ similar, onOpenExisting, onContinue }: SimilarItemsAlertProps) {
  if (!similar.length) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="mb-2 font-medium text-amber-900">Hasonló tétel már létezik</p>
      <ul className="mb-3 space-y-1">
        {similar.map(({ item, score }) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-amber-950">
              {item.identifier} — {item.shortLabel ?? item.text}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-amber-700">{score}%</span>
              <Button type="button" size="sm" variant="outline" onClick={() => onOpenExisting(item)}>
                Megnyitás
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" onClick={onContinue}>
        Így is mentem (új tétel)
      </Button>
    </div>
  )
}
