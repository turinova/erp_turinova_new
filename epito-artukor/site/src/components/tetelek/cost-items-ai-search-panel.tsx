"use client"

import { Loader2, Plus, Sparkles } from "lucide-react"
import type { CostItem } from "@/types"
import type { AiSearchResult } from "@/lib/cost-items/ai-search-types"
import { formatHuf } from "@/lib/pricing"
import { getQuoteDisplayIdentifier } from "@/lib/item-identifier"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type CostItemsAiSearchPanelProps = {
  query: string
  loading: boolean
  result: AiSearchResult | null
  itemsById: Map<string, CostItem>
  onOpenItem: (item: CostItem) => void
  onCreateSuggested: () => void
}

export function CostItemsAiSearchPanel({
  query,
  loading,
  result,
  itemsById,
  onOpenItem,
  onCreateSuggested,
}: CostItemsAiSearchPanelProps) {
  if (!query.trim() || query.trim().length < 3) return null

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <Loader2 className="h-4 w-4 animate-spin" />
        AI keresés: „{query.trim()}”…
      </div>
    )
  }

  if (!result) return null

  const resolvedMatches = result.matches
    .map((m) => ({ match: m, item: itemsById.get(m.itemId) }))
    .filter((r): r is { match: (typeof result.matches)[0]; item: CostItem } => Boolean(r.item))

  if (resolvedMatches.length === 0 && !result.suggestNewItem) return null

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-violet-950">
        <Sparkles className="h-4 w-4 text-violet-600" />
        AI keresés
        {result.aiUsed ? (
          <Badge variant="secondary" className="text-xs">
            AI
          </Badge>
        ) : null}
        <span className="font-normal text-violet-700">— „{query.trim()}”</span>
      </div>

      {resolvedMatches.length > 0 ? (
        <ul className="space-y-1.5">
          {resolvedMatches.map(({ match, item }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpenItem(item)}
                className="flex w-full items-start justify-between gap-3 rounded-md border border-violet-100 bg-white px-3 py-2 text-left text-sm hover:border-violet-300 hover:bg-violet-50/50"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-code text-xs text-violet-700">
                    {getQuoteDisplayIdentifier(item)}
                  </span>
                  <p className="mt-0.5 whitespace-normal break-words text-slate-800">
                    {item.text}
                  </p>
                  <p className="mt-0.5 text-xs text-violet-600">{match.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    variant={match.score >= 75 ? "success" : "warning"}
                    className="font-code text-xs"
                  >
                    {match.score}%
                  </Badge>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {formatHuf(item.totalUnitPrice)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {result.suggestNewItem ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
          <p className="font-medium text-amber-950">
            {resolvedMatches.length === 0
              ? "Nem találtunk megfelelő tételt a katalógusban."
              : "A találatok gyengék — érdemes lehet új tételt felvenni."}
          </p>
          {result.suggestedText ? (
            <p className="mt-1 text-xs text-amber-800">
              Javasolt szöveg: <span className="font-medium">{result.suggestedText}</span>
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="mt-2"
            onClick={onCreateSuggested}
          >
            <Plus className="h-4 w-4" />
            Új K-tétel létrehozása
          </Button>
        </div>
      ) : null}
    </div>
  )
}
