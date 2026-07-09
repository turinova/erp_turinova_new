import Anthropic from "@anthropic-ai/sdk"
import type { Category, CostItem } from "@/types"
import type { AiSearchMatch } from "@/lib/cost-items/ai-search-types"
import type {
  QuoteImportInputRow,
  QuoteImportMatchedRow,
  QuoteImportMatchSource,
} from "@/lib/cost-items/quote-import-types"
import { expandQueryTokens, getSearchableText } from "@/lib/cost-item-search"
import { normalizeHu } from "@/lib/polish-item-text"

const MODEL = "claude-haiku-4-5-20251001"
const BATCH_SIZE = 20
const FUZZY_THRESHOLD = 0.78
const LOCAL_MATCH_THRESHOLD = 62
const AI_MATCH_THRESHOLD = 50
const LOCAL_CANDIDATE_LIMIT = 50

type ClaudeMatchItem = {
  lineNumber: number
  itemId: string | null
  score?: number
  reason?: string
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

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

function textSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function localRankCandidates(
  query: string,
  items: CostItem[],
  categories: Category[]
): Array<{ item: CostItem; score: number }> {
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const tokens = expandQueryTokens(query)
  const normQ = normalizeHu(query)

  return items
    .map((item) => {
      const hay = getSearchableText(item)
      const catName = categoryMap[item.categoryId]?.name ?? ""
      const enrichedHay = `${hay} ${normalizeHu(catName)}`

      let score = 0
      for (const token of tokens) {
        if (enrichedHay.includes(token)) score += 12
      }
      if (normQ.length >= 6 && enrichedHay.includes(normQ)) score += 25

      const textNorm = normalizeHu(item.text)
      if (textNorm.includes(normQ)) score += 20

      return { item, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, LOCAL_CANDIDATE_LIMIT)
}

function findByIdentifier(
  identifierHint: string | null,
  items: CostItem[]
): CostItem | null {
  if (!identifierHint?.trim()) return null
  const key = identifierHint.trim().toLowerCase()
  return items.find((item) => item.identifier.toLowerCase() === key) ?? null
}

function findFuzzyCatalogMatch(
  text: string,
  items: CostItem[]
): { item: CostItem; score: number } | null {
  const normInput = normalizeHu(text)
  if (normInput.length < 8) return null

  let best: { item: CostItem; score: number } | null = null
  for (const item of items) {
    const score = textSimilarity(normInput, normalizeHu(item.text.trim()))
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { item, score }
    }
  }
  return best
}

function parseClaudeMatchJson(raw: string): ClaudeMatchItem[] | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeMatchItem[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function batchMatchWithClaude(
  rows: Array<{
    line: QuoteImportInputRow
    candidates: CostItem[]
  }>
): Promise<Map<number, ClaudeMatchItem>> {
  const client = getAnthropicClient()
  const result = new Map<number, ClaudeMatchItem>()
  if (!client || rows.length === 0) return result

  const blocks = rows
    .map(({ line, candidates }) => {
      const numbered = candidates
        .map((item, idx) => `    ${idx + 1}. [id:${item.id}] ${item.text.slice(0, 140)}`)
        .join("\n")
      return `Sor ${line.lineNumber}: "${line.text}"\n  Jelöltek:\n${numbered || "    (nincs)"}`
    })
    .join("\n\n")

  const prompt = `Te egy magyar építőipari ártükör párosító assisztens vagy.

Feladat: minden bemeneti sorhoz válaszd ki a legjobban illő KATALÓGUS tételt (itemId).
Ne hozz létre új tételt — csak a jelöltek közül válassz.
Ha egyik sem illik jól (score < 50), itemId legyen null.

Bemenetek:
${blocks}

Válaszolj KIZÁRÓLAG JSON tömbbel:
[
  { "lineNumber": 1, "itemId": "uuid-vagy-null", "score": 88, "reason": "rövid magyarázat" }
]`

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    })

    const block = message.content.find((part) => part.type === "text")
    if (!block || block.type !== "text") return result

    const parsed = parseClaudeMatchJson(block.text)
    if (!parsed) return result

    for (const entry of parsed) {
      result.set(entry.lineNumber, entry)
    }
  } catch (error) {
    console.error("Claude quote import match error:", error)
  }

  return result
}

function toAlternatives(
  ranked: Array<{ item: CostItem; score: number }>,
  excludeId?: string
): AiSearchMatch[] {
  return ranked
    .filter((r) => r.item.id !== excludeId)
    .slice(0, 4)
    .map((r) => ({
      itemId: r.item.id,
      score: Math.min(100, Math.round(r.score)),
      reason: "Kulcsszó egyezés",
    }))
}

function buildMatchedRow(
  line: QuoteImportInputRow,
  item: CostItem | null,
  score: number,
  source: QuoteImportMatchSource,
  alternatives: AiSearchMatch[],
  aiUsed: boolean,
  reason?: string
): QuoteImportMatchedRow {
  return {
    lineNumber: line.lineNumber,
    rawInput: line.rawInput,
    text: line.text,
    quantity: line.quantity,
    matchedCostItemId: item?.id ?? null,
    matchedText: item?.text ?? null,
    matchScore: Math.min(100, Math.round(score)),
    matchSource: source,
    alternatives: item
      ? alternatives
      : alternatives.length > 0
        ? alternatives
        : reason
          ? [{ itemId: "", score: 0, reason }]
          : [],
    trade: item?.trade ?? null,
    aiUsed,
  }
}

export function isQuoteImportAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function matchQuoteImportLines(
  lines: QuoteImportInputRow[],
  context: {
    items: CostItem[]
    categories: Category[]
  }
): Promise<QuoteImportMatchedRow[]> {
  const activeItems = context.items.filter((item) => item.status === "active")
  const itemById = new Map(activeItems.map((item) => [item.id, item]))

  const resolved = new Map<number, QuoteImportMatchedRow>()
  const needsAi: Array<{ line: QuoteImportInputRow; candidates: CostItem[] }> = []

  for (const line of lines) {
    const byId = findByIdentifier(line.identifierHint, activeItems)
    if (byId) {
      resolved.set(
        line.lineNumber,
        buildMatchedRow(line, byId, 100, "identifier", [], false)
      )
      continue
    }

    const fuzzy = findFuzzyCatalogMatch(line.text, activeItems)
    if (fuzzy) {
      const ranked = localRankCandidates(line.text, activeItems, context.categories)
      resolved.set(
        line.lineNumber,
        buildMatchedRow(
          line,
          fuzzy.item,
          fuzzy.score * 100,
          "fuzzy",
          toAlternatives(ranked, fuzzy.item.id),
          false
        )
      )
      continue
    }

    const ranked = localRankCandidates(line.text, activeItems, context.categories)
    const best = ranked[0]
    if (best && best.score >= LOCAL_MATCH_THRESHOLD) {
      resolved.set(
        line.lineNumber,
        buildMatchedRow(
          line,
          best.item,
          best.score,
          "local",
          toAlternatives(ranked, best.item.id),
          false
        )
      )
      continue
    }

    needsAi.push({
      line,
      candidates: ranked.slice(0, 5).map((r) => r.item),
    })
  }

  for (let i = 0; i < needsAi.length; i += BATCH_SIZE) {
    const batch = needsAi.slice(i, i + BATCH_SIZE)
    const aiResults = await batchMatchWithClaude(batch)

    for (const { line, candidates } of batch) {
      const ai = aiResults.get(line.lineNumber)
      const ranked = localRankCandidates(line.text, activeItems, context.categories)

      if (ai?.itemId) {
        const item = itemById.get(ai.itemId)
        if (item && (ai.score ?? 70) >= AI_MATCH_THRESHOLD) {
          resolved.set(
            line.lineNumber,
            buildMatchedRow(
              line,
              item,
              ai.score ?? 70,
              "ai",
              toAlternatives(ranked, item.id),
              true,
              ai.reason
            )
          )
          continue
        }
      }

      if (ranked[0] && ranked[0].score >= 40) {
        resolved.set(
          line.lineNumber,
          buildMatchedRow(
            line,
            ranked[0].item,
            ranked[0].score,
            "local",
            toAlternatives(ranked, ranked[0].item.id),
            false
          )
        )
        continue
      }

      resolved.set(
        line.lineNumber,
        buildMatchedRow(line, null, 0, "none", toAlternatives(ranked), false)
      )
    }
  }

  return lines.map((line) => resolved.get(line.lineNumber)!)
}
