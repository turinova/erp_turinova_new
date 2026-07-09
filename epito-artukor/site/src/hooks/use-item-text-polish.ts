"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import type { CostItem, Trade } from "@/types"
import type { TextPolishResult } from "@/lib/polish-item-text"
import { polishItemTextLocal } from "@/lib/polish-item-text"

type PolishContext = {
  trade?: Trade
  categoryId?: string
  referenceItems?: CostItem[]
}

export function useItemTextPolish() {
  const [result, setResult] = useState<TextPolishResult | null>(null)
  const [loading, setLoading] = useState(false)

  const clearPolish = useCallback(() => setResult(null), [])

  const polishText = useCallback(
    async (text: string, context: PolishContext): Promise<TextPolishResult> => {
      if (!text.trim()) {
        const empty = { original: text, polished: text, changed: false, changes: [] }
        setResult(null)
        return empty
      }

      setLoading(true)
      try {
        const res = await fetch("/api/polish-item-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            trade: context.trade,
            categoryId: context.categoryId,
            referenceItems: context.referenceItems?.map((item) => ({
              id: item.id,
              text: item.text,
              shortLabel: item.shortLabel,
              trade: item.trade,
              categoryId: item.categoryId,
            })),
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as TextPolishResult
          if (data.changed) {
            setResult(data)
            toast.success(data.aiUsed ? "AI-vel javítva" : "Javítva", { duration: 2000 })
          } else {
            setResult(null)
            toast.info("Nincs javítanivaló", { duration: 2000 })
          }
          return data
        }
      } catch {
        /* offline fallback */
      }

      const local = polishItemTextLocal(text, context)
      if (local.changed) {
        setResult(local)
        toast.success("Javítva", { duration: 2000 })
      } else {
        setResult(null)
        toast.info("Nincs javítanivaló", { duration: 2000 })
      }
      return local
    },
    []
  )

  const polishTextWithLoading = useCallback(
    async (text: string, context: PolishContext) => {
      try {
        return await polishText(text, context)
      } finally {
        setLoading(false)
      }
    },
    [polishText]
  )

  return {
    polishResult: result,
    polishLoading: loading,
    polishText: polishTextWithLoading,
    clearPolish,
  }
}
