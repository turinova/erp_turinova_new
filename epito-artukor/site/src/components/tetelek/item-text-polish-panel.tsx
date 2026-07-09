"use client"

import { RotateCcw, Sparkles } from "lucide-react"
import type { TextPolishResult } from "@/lib/polish-item-text"
import { Button } from "@/components/ui/button"

type ItemTextPolishPanelProps = {
  result: TextPolishResult | null
  loading?: boolean
  onRevert: () => void
}

export function ItemTextPolishPanel({ result, loading, onRevert }: ItemTextPolishPanelProps) {
  if (loading) {
    return (
      <p className="text-xs text-slate-500">
        <Sparkles className="mr-1 inline h-3 w-3 animate-pulse" />
        Javítás…
      </p>
    )
  }

  if (!result?.changed) return null

  return (
    <div className="flex items-center gap-2 text-xs text-emerald-700">
      <Sparkles className="h-3 w-3 shrink-0" />
      <span>{result.aiUsed ? "AI-vel javítva" : "Javítva"}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-1.5 text-xs text-slate-500 hover:text-slate-800"
        onClick={onRevert}
      >
        <RotateCcw className="mr-1 h-3 w-3" />
        Vissza
      </Button>
    </div>
  )
}

/** Textarea keret módosított szöveghez */
export function polishedTextareaClass(changed: boolean): string {
  return changed
    ? "border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-200"
    : ""
}
