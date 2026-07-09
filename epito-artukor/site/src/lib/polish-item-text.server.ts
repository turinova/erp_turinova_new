import Anthropic from "@anthropic-ai/sdk"
import { getCategoryMap } from "@/lib/data/categories-store"
import type { TextPolishChange } from "@/lib/polish-item-text"
import { getTradeLabel } from "@/lib/trades"
import type { CostItem, Trade } from "@/types"

const MODEL = "claude-haiku-4-5-20251001"

type ClaudePolishResponse = {
  polished: string
  changes: Array<{
    type?: TextPolishChange["type"]
    from: string
    to: string
    reason?: string
  }>
}

export type ClaudePolishOptions = {
  original: string
  trade?: Trade
  categoryId?: string
  referenceItems?: CostItem[]
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

function buildCatalogExamples(items: CostItem[] | undefined, trade?: Trade): string[] {
  const pool = (items ?? [])
    .filter((item) => !trade || item.trade === trade)
    .slice(0, 15)
    .map((item) => item.text.trim())
    .filter(Boolean)

  return [...new Set(pool)]
}

function buildPrompt(text: string, options: ClaudePolishOptions): string {
  const tradeLabel = options.trade ? getTradeLabel(options.trade) : "ismeretlen szakág"
  const category = options.categoryId ? getCategoryMap()[options.categoryId] : undefined
  const categoryLabel = category
    ? category.parentId
      ? category.name
      : `${category.name} (általános)`
    : "nincs megadva"

  const examples = buildCatalogExamples(options.referenceItems, options.trade)

  return `Te egy magyar építőipari ártükör szövegszerkesztő asszisztens vagy.

Feladat: javítsd a tétel leírását helyesírás, ékezet, ragozás és építőipari terminológia szerint.

SZABÁLYOK:
- NE változtasd a munka tartalmát, mennyiségét, árát vagy műszaki paramétereit.
- Csak helyesírást, ékezetet, ragozást, felesleges szóközt, dupla betűt javíts (pl. "tetőő" → "tető", "bbontás" → "bontás").
- Használd az építőipari katalógus stílusát: tömör, szakmai megfogalmazás.
- A mondat kezdődjön nagybetűvel.
- Ha a szöveg már helyes, add vissza változatlanul üres changes tömbbel.

Kontextus:
- Szakág: ${tradeLabel}
- Szekció: ${categoryLabel}
- Felhasználó eredeti szövege: ${options.original}
- Jelenlegi szöveg (előfeldolgozva): ${text}

${examples.length > 0 ? `Példák a katalógusból (terminológia):\n${examples.map((e) => `- ${e}`).join("\n")}` : ""}

Válaszolj KIZÁRÓLAG érvényes JSON-nal, más szöveg nélkül:
{
  "polished": "javított szöveg",
  "changes": [
    { "type": "spelling", "from": "eredeti részlet", "to": "javított részlet", "reason": "rövid magyarázat" }
  ]
}`
}

function parseClaudeJson(raw: string): ClaudePolishResponse | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ClaudePolishResponse
    if (typeof parsed.polished !== "string" || !Array.isArray(parsed.changes)) return null
    return parsed
  } catch {
    return null
  }
}

function normalizeChanges(changes: ClaudePolishResponse["changes"]): TextPolishChange[] {
  const validTypes = new Set<TextPolishChange["type"]>([
    "spelling",
    "grammar",
    "style",
    "terminology",
  ])

  return changes
    .filter((c) => c.from && c.to && c.from !== c.to)
    .map((c) => ({
      type: validTypes.has(c.type as TextPolishChange["type"])
        ? (c.type as TextPolishChange["type"])
        : "spelling",
      from: c.from,
      to: c.to,
      reason: c.reason ? `AI: ${c.reason}` : "AI javítás",
    }))
}

/** Claude API — magyar építőipari tétel szöveg javítás (csak szerveren) */
export async function polishItemTextWithClaude(
  text: string,
  options: ClaudePolishOptions
): Promise<{ text: string; changes: TextPolishChange[] } | null> {
  const client = getAnthropicClient()
  if (!client || !text.trim()) return null

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: buildPrompt(text, options),
        },
      ],
    })

    const block = message.content.find((part) => part.type === "text")
    if (!block || block.type !== "text") return null

    const parsed = parseClaudeJson(block.text)
    if (!parsed) return null

    const polished = parsed.polished.trim()
    if (!polished) return null

    return {
      text: polished,
      changes: normalizeChanges(parsed.changes),
    }
  } catch (error) {
    console.error("Claude polish error:", error)
    return null
  }
}

export function isClaudePolishAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}
