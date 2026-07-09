import type { CostItem, Trade } from "@/types"
import { matchCatalogPhrase } from "@/lib/catalog-phrase-match"
import { applyHunspellCorrections } from "@/lib/hu-spellcheck.server"
import {
  isClaudePolishAvailable,
  polishItemTextWithClaude,
} from "@/lib/polish-item-text.server"
import { mergePolishResults, polishItemTextLocal } from "@/lib/polish-item-text"

type RequestBody = {
  text: string
  trade?: Trade
  categoryId?: string
  referenceItems?: CostItem[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody
    const { text, trade, categoryId, referenceItems } = body
    const original = text?.trim() ?? ""

    if (!original) {
      return Response.json({
        original: "",
        polished: "",
        changed: false,
        changes: [],
        aiUsed: false,
      })
    }

    // 1. Építőipari szabályok + katalógus szavak
    let result = polishItemTextLocal(original, { referenceItems, trade, categoryId })
    let aiUsed = false

    // 2. Hunspell (jelenleg kikapcsolva — memóriahiba miatt)
    const hunspell = applyHunspellCorrections(result.polished)
    result = mergePolishResults(result, hunspell.changes, hunspell.text)

    // 3. Teljes mondat illesztés katalógus tételekhez
    const phrase = matchCatalogPhrase(result.polished, referenceItems ?? [], {
      trade,
      categoryId,
    })
    if (phrase.changes.length > 0) {
      result = mergePolishResults(result, phrase.changes, phrase.text)
    }

    // 4. Claude AI — gépelési hibák, ragozás, kontextus
    if (isClaudePolishAvailable()) {
      const claude = await polishItemTextWithClaude(result.polished, {
        original,
        trade,
        categoryId,
        referenceItems,
      })

      if (claude && claude.text !== result.polished) {
        result = mergePolishResults(result, claude.changes, claude.text)
        aiUsed = true
      } else if (claude && claude.changes.length > 0) {
        result = mergePolishResults(result, claude.changes, claude.text)
        aiUsed = true
      }
    }

    return Response.json({ ...result, aiUsed })
  } catch (error) {
    console.error("polish-item-text error:", error)
    return Response.json({ error: "Polish failed" }, { status: 500 })
  }
}
