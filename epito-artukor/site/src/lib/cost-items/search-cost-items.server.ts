import Anthropic from "@anthropic-ai/sdk"
import type { Category, CostItem, Unit } from "@/types"
import type { TradeRecord } from "@/types/trade"
import type { AiSearchMatch, AiSearchResult } from "@/lib/cost-items/ai-search-types"
import { classifyPasteItems } from "@/lib/cost-items/classify-cost-item.server"
import { parsePasteImportText } from "@/lib/cost-items/parse-paste-import"
import { getSearchableText, expandQueryTokens } from "@/lib/cost-item-search"
import { normalizeHu } from "@/lib/polish-item-text"

const MODEL = "claude-haiku-4-5-20251001"
const MIN_QUERY_LEN = 3
const SUGGEST_NEW_THRESHOLD = 62
const LOCAL_CANDIDATE_LIMIT = 50

type ClaudeRankItem = {
  itemId: string
  score: number
  reason?: string
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
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

function parseClaudeRankJson(raw: string): ClaudeRankItem[] | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeRankItem[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function rankWithClaude(
  query: string,
  candidates: CostItem[]
): Promise<ClaudeRankItem[] | null> {
  const client = getAnthropicClient()
  if (!client || candidates.length === 0) return null

  const numbered = candidates
    .map((item, idx) => `${idx + 1}. [id:${item.id}] ${item.text.slice(0, 120)}`)
    .join("\n")

  const prompt = `Te egy magyar építőipari ártükör kereső asszisztens vagy.

Felhasználó keresése: "${query}"

Katalógus jelöltek:
${numbered}

Feladat: válaszd ki a legjobban illő tételeket (szemantikai egyezés, nem csak szóegyezés).
Pl. "fal glettelése q2 minőségben" → glettelés, fal simítás, Q2 minőségű felület.

Válaszolj KIZÁRÓLAG JSON tömbbel (max 5 elem, score 0-100):
[
  { "itemId": "uuid", "score": 88, "reason": "rövid magyarázat" }
]

Ha egyik sem illik jól (score < 50), adj vissza üres tömböt [].`

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    })

    const block = message.content.find((part) => part.type === "text")
    if (!block || block.type !== "text") return null
    return parseClaudeRankJson(block.text)
  } catch (error) {
    console.error("Claude search rank error:", error)
    return null
  }
}

export async function searchCostItemsWithAi(
  query: string,
  context: {
    items: CostItem[]
    categories: Category[]
    trades: TradeRecord[]
    units: Unit[]
  }
): Promise<AiSearchResult> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LEN) {
    return { matches: [], suggestNewItem: false, aiUsed: false }
  }

  const localRanked = localRankCandidates(trimmed, context.items, context.categories)

  if (localRanked.length === 0) {
    const classified = await classifyPasteItems(parsePasteImportText(trimmed), {
      trades: context.trades,
      categories: context.categories,
      units: context.units,
      existingItems: context.items,
    })
    const first = classified[0]
    return {
      matches: [],
      suggestNewItem: true,
      suggestedText: first?.text ?? trimmed,
      suggestedTradeCode: first?.tradeCode ?? undefined,
      suggestedCategoryCode: first?.categoryCode ?? undefined,
      aiUsed: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    }
  }

  const claudeRanked = await rankWithClaude(
    trimmed,
    localRanked.map((r) => r.item)
  )

  let matches: AiSearchMatch[]
  let aiUsed = false

  if (claudeRanked && claudeRanked.length > 0) {
    const validIds = new Set(context.items.map((i) => i.id))
    matches = claudeRanked
      .filter((r) => validIds.has(r.itemId) && r.score >= 40)
      .slice(0, 5)
      .map((r) => ({
        itemId: r.itemId,
        score: Math.min(100, Math.round(r.score)),
        reason: r.reason?.trim() || "AI egyezés",
      }))
    aiUsed = true
  } else {
    matches = localRanked.slice(0, 5).map((r) => ({
      itemId: r.item.id,
      score: Math.min(100, r.score),
      reason: "Kulcsszó egyezés",
    }))
  }

  const bestScore = matches[0]?.score ?? 0
  const suggestNewItem = bestScore < SUGGEST_NEW_THRESHOLD

  let suggestedText: string | undefined
  let suggestedTradeCode: string | undefined
  let suggestedCategoryCode: string | undefined

  if (suggestNewItem) {
    const classified = await classifyPasteItems(parsePasteImportText(trimmed), {
      trades: context.trades,
      categories: context.categories,
      units: context.units,
      existingItems: context.items,
    })
    const first = classified[0]
    suggestedText = first?.text ?? trimmed
    suggestedTradeCode = first?.tradeCode ?? undefined
    suggestedCategoryCode = first?.categoryCode ?? undefined
  }

  return {
    matches,
    suggestNewItem,
    suggestedText,
    suggestedTradeCode,
    suggestedCategoryCode,
    aiUsed,
  }
}
