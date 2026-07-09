import type { CostItem, Trade } from "@/types"
import type { TextPolishChange } from "@/lib/polish-item-text"
import { normalizeHu } from "@/lib/polish-item-text"

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function similarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  const dist = levenshtein(a, b)
  return 1 - dist / Math.max(a.length, b.length)
}

/** Ha a szöveg nagyon hasonló egy katalógus-tételhez, azt a megfogalmazást használjuk */
export function matchCatalogPhrase(
  text: string,
  items: CostItem[],
  options?: { trade?: Trade; categoryId?: string; minScore?: number }
): { text: string; changes: TextPolishChange[] } {
  const minScore = options?.minScore ?? 0.72
  const input = text.trim()
  const normInput = normalizeHu(input)
  if (normInput.length < 12) {
    return { text: input, changes: [] }
  }

  const pool = items.filter((item) => {
    if (options?.trade && item.trade !== options.trade) return false
    if (options?.categoryId && item.categoryId !== options.categoryId) return false
    return true
  })

  let best: { text: string; score: number } | null = null
  for (const item of pool) {
    const candidate = item.text.trim()
    const score = similarity(normInput, normalizeHu(candidate))
    if (score >= minScore && (!best || score > best.score)) {
      best = { text: candidate, score }
    }
  }

  if (!best || best.text === input) {
    return { text: input, changes: [] }
  }

  return {
    text: best.text,
    changes: [
      {
        type: "terminology",
        from: input.length > 80 ? `${input.slice(0, 80)}…` : input,
        to: best.text.length > 80 ? `${best.text.slice(0, 80)}…` : best.text,
        reason: `Katalógus megfogalmazás (${Math.round(best.score * 100)}% egyezés)`,
      },
    ],
  }
}
