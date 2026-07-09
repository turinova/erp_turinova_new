import Anthropic from "@anthropic-ai/sdk"
import type { Category, CostItem, Unit } from "@/types"
import { normalizeHu } from "@/lib/polish-item-text"
import type { ParsedPasteLine } from "@/lib/cost-items/parse-paste-import"
import type { TradeRecord } from "@/types/trade"

const MODEL = "claude-haiku-4-5-20251001"
const BATCH_SIZE = 20

export type ClassifiedPasteItem = {
  lineNumber: number
  raw: string
  text: string
  materialUnitPrice: number
  laborUnitPrice: number
  tradeCode: string | null
  categoryCode: string | null
  unitCode: string | null
  confidence: number
  aiUsed: boolean
  source: "catalog" | "ai" | "heuristic"
}

type ClaudeClassifyItem = {
  index: number
  trade?: string
  category?: string
  unit?: string
  polishedText?: string
  materialUnitPrice?: number
  laborUnitPrice?: number
  confidence?: number
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

function similarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function buildTaxonomyPrompt(
  trades: TradeRecord[],
  categories: Category[],
  units: Unit[]
): string {
  const tradeBlocks = trades.map((t) => {
    const cats = categories
      .filter((c) => c.trade === t.code)
      .map((c) => `    ${c.code}: ${c.name}`)
      .join("\n")
    return `  ${t.code}: ${t.name}\n${cats || "    (nincs kategória)"}`
  })

  const unitList = units.map((u) => `${u.code} (${u.name})`).join(", ")

  return `Szakágak és kategóriák:\n${tradeBlocks.join("\n\n")}\n\nMértékegységek: ${unitList}`
}

function buildClassifyPrompt(
  items: ParsedPasteLine[],
  taxonomy: string,
  offset: number
): string {
  const numbered = items
    .map((item, idx) => `${offset + idx + 1}. "${item.text}"${item.unitHint ? ` [ME jelzés: ${item.unitHint}]` : ""}`)
    .join("\n")

  return `Te egy magyar építőipari ártükör asszisztens vagy.

${taxonomy}

Feladat: minden tételhez válaszd ki a legmegfelelőbb szakág kódot, kategória kódot és mértékegység kódot.
A tétel szövegét igazítsd építőipari katalógus stílusra (ékezet, helyesírás), de NE változtasd a munka tartalmát.

Ár szabály: mindig materialUnitPrice=0 és laborUnitPrice=0 (az árat később adják meg).

Tételek:
${numbered}

Válaszolj KIZÁRÓLAG érvényes JSON tömbbel:
[
  {
    "index": 1,
    "trade": "epitomester",
    "category": "EM-01",
    "unit": "m2",
    "polishedText": "javított szöveg",
    "materialUnitPrice": 0,
    "laborUnitPrice": 0,
    "confidence": 85
  }
]

confidence: 0-100, mennyire biztos a besorolásban.`
}

function parseClaudeClassifyJson(raw: string): ClaudeClassifyItem[] | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudeClassifyItem[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function resolveUnitCode(
  hint: string | undefined,
  suggested: string | undefined,
  units: Unit[]
): string | null {
  const byCode = new Map(units.map((u) => [u.code.toLowerCase(), u.code]))
  if (suggested) {
    const hit = byCode.get(suggested.toLowerCase())
    if (hit) return hit
  }
  if (hint) {
    const normalized = hint.toLowerCase().replace("m²", "m2").replace("m³", "m3")
    const hit = byCode.get(normalized)
    if (hit) return hit
  }
  return byCode.get("klt") ?? units[0]?.code ?? null
}

function classifyFromCatalog(
  line: ParsedPasteLine,
  existingItems: CostItem[],
  categories: Category[],
  units: Unit[]
): ClassifiedPasteItem | null {
  const normInput = normalizeHu(line.text)
  if (normInput.length < 8) return null

  let best: { item: CostItem; score: number } | null = null
  for (const item of existingItems) {
    const score = similarity(normInput, normalizeHu(item.text.trim()))
    if (score >= 0.78 && (!best || score > best.score)) {
      best = { item, score }
    }
  }

  if (!best) return null

  const category = categories.find((c) => c.id === best!.item.categoryId)
  const unit = units.find((u) => u.id === best!.item.unitId)

  return {
    lineNumber: line.lineNumber,
    raw: line.raw,
    text: best.item.text,
    materialUnitPrice: 0,
    laborUnitPrice: 0,
    tradeCode: best.item.trade,
    categoryCode: category?.code ?? null,
    unitCode: unit?.code ?? null,
    confidence: Math.round(best.score * 100),
    aiUsed: false,
    source: "catalog",
  }
}

function heuristicClassify(
  line: ParsedPasteLine,
  trades: TradeRecord[],
  categories: Category[],
  units: Unit[]
): ClassifiedPasteItem {
  const lower = line.text.toLowerCase()
  const rules: Array<{ keywords: string[]; trade: string }> = [
    { keywords: ["burkol", "csempe", "járólap", "esztrich"], trade: "burkolas" },
    { keywords: ["fest", "glett", "tapéta", "mázol"], trade: "festes" },
    { keywords: ["elektrom", "kábel", "kapcsoló", "világít", "ev töltő", "töltő"], trade: "elektromos" },
    { keywords: ["fűtés", "radiátor", "hőszivatty", "kazán", "padlófűtés"], trade: "futes-hutes" },
    { keywords: ["gépész", "cső", "szaniter", "wc ", "mosdó"], trade: "gepeszet" },
    { keywords: ["nyílászáró", "ablak", "ajtó", "redőny"], trade: "nyilaszaró" },
    { keywords: ["bontás", "bont"], trade: "bontas" },
    { keywords: ["takarít", "lomtalanít"], trade: "takaritas" },
    { keywords: ["kert", "füvesít", "öntöz"], trade: "kertepites" },
    { keywords: ["tető", "cserép", "lemezfed"], trade: "tetofedes" },
    { keywords: ["ács", "födém", "gerenda", "tetőszerkezet"], trade: "acs" },
  ]

  let tradeCode = trades.find((t) => t.code === "epitomester")?.code ?? trades[0]?.code ?? null
  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      tradeCode = rule.trade
      break
    }
  }

  const category =
    categories
      .filter((c) => c.trade === tradeCode)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null

  return {
    lineNumber: line.lineNumber,
    raw: line.raw,
    text: line.text,
    materialUnitPrice: line.materialUnitPrice,
    laborUnitPrice: line.laborUnitPrice,
    tradeCode,
    categoryCode: category?.code ?? null,
    unitCode: resolveUnitCode(line.unitHint, undefined, units),
    confidence: 35,
    aiUsed: false,
    source: "heuristic",
  }
}

async function classifyBatchWithClaude(
  items: ParsedPasteLine[],
  trades: TradeRecord[],
  categories: Category[],
  units: Unit[]
): Promise<Map<number, ClaudeClassifyItem>> {
  const client = getAnthropicClient()
  const result = new Map<number, ClaudeClassifyItem>()
  if (!client || items.length === 0) return result

  const taxonomy = buildTaxonomyPrompt(trades, categories, units)
  const prompt = buildClassifyPrompt(items, taxonomy, 0)

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    })

    const block = message.content.find((part) => part.type === "text")
    if (!block || block.type !== "text") return result

    const parsed = parseClaudeClassifyJson(block.text)
    if (!parsed) return result

    for (const entry of parsed) {
      const pos = entry.index - 1
      const line = items[pos]
      if (line) {
        result.set(line.lineNumber, entry)
      }
    }
  } catch (error) {
    console.error("Claude classify error:", error)
  }

  return result
}

export function isClassifyAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export async function classifyPasteItems(
  lines: ParsedPasteLine[],
  context: {
    trades: TradeRecord[]
    categories: Category[]
    units: Unit[]
    existingItems: CostItem[]
  }
): Promise<ClassifiedPasteItem[]> {
  const { trades, categories, units, existingItems } = context
  const tradeCodes = new Set(trades.map((t) => t.code))
  const categoryCodes = new Set(categories.map((c) => c.code.toUpperCase()))
  const unitCodes = new Map(units.map((u) => [u.code.toLowerCase(), u.code]))

  const needsAi: ParsedPasteLine[] = []
  const preliminary = new Map<number, ClassifiedPasteItem>()

  for (const line of lines) {
    const catalog = classifyFromCatalog(line, existingItems, categories, units)
    if (catalog && catalog.confidence >= 80) {
      preliminary.set(line.lineNumber, catalog)
    } else {
      needsAi.push(line)
    }
  }

  const aiResults = new Map<number, ClaudeClassifyItem>()
  for (let i = 0; i < needsAi.length; i += BATCH_SIZE) {
    const batch = needsAi.slice(i, i + BATCH_SIZE)
    const batchMap = await classifyBatchWithClaude(batch, trades, categories, units)
    for (const [lineNumber, value] of batchMap) {
      aiResults.set(lineNumber, value)
    }
  }

  const output: ClassifiedPasteItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const cached = preliminary.get(line.lineNumber)
    if (cached) {
      output.push(cached)
      continue
    }

    const ai = aiResults.get(line.lineNumber)

    if (ai) {
      const tradeCode =
        ai.trade && tradeCodes.has(ai.trade) ? ai.trade : heuristicClassify(line, trades, categories, units).tradeCode
      const categoryCode =
        ai.category && categoryCodes.has(ai.category.toUpperCase())
          ? ai.category.toUpperCase()
          : categories.find((c) => c.trade === tradeCode)?.code ?? null
      const unitCode =
        ai.unit && unitCodes.has(ai.unit.toLowerCase())
          ? unitCodes.get(ai.unit.toLowerCase())!
          : resolveUnitCode(line.unitHint, ai.unit, units)

      output.push({
        lineNumber: line.lineNumber,
        raw: line.raw,
        text: (ai.polishedText?.trim() || line.text).trim(),
        materialUnitPrice: 0,
        laborUnitPrice: 0,
        tradeCode,
        categoryCode,
        unitCode,
        confidence: Math.min(100, Math.max(0, Math.round(ai.confidence ?? 70))),
        aiUsed: true,
        source: "ai",
      })
      continue
    }

    output.push(heuristicClassify(line, trades, categories, units))
  }

  return output
}
