/**
 * Opti panel képimport — Anthropic vision, csak Szál / Kereszt / Db.
 * Minta: b2b-portal parse-order.ts (tool_choice + normalize).
 * Doc: docs/47-opti-panel-import.md
 */

import Anthropic from '@anthropic-ai/sdk'

export type VisionPanelLine = {
  grainMm: number | null
  crossMm: number | null
  quantity: number
  quantityUncertain: boolean
  dimsUncertain: boolean
  confidence: number
  rawText: string
  notes: string | null
}

export type VisionParseResult = {
  documentKind:
    | 'handwritten_list'
    | 'printed_table'
    | 'screenshot'
    | 'mixed'
    | 'unknown'
  lines: VisionPanelLine[]
  warnings: string[]
  model: string
}

const VISION_MODEL =
  process.env.ANTHROPIC_VISION_MODEL?.trim() || 'claude-sonnet-4-6'

const MAX_VISION_LINES = 200

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY nincs beállítva. Add hozzá a .env.local fájlhoz.'
    )
  }
  return new Anthropic({ apiKey: key })
}

const EXTRACT_TOOL: Anthropic.Messages.Tool = {
  name: 'extract_panel_dims',
  description:
    'Extract furniture panel cutting dimensions (grain mm, cross mm, quantity) from a photo or screenshot. Do not extract edge banding or labels as structured fields.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      documentKind: {
        type: 'string',
        enum: [
          'handwritten_list',
          'printed_table',
          'screenshot',
          'mixed',
          'unknown'
        ]
      },
      warnings: {
        type: 'array',
        items: {
          type: 'string',
          description: 'Rövid magyar figyelmeztetés a felhasználónak'
        }
      },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rawText: {
              type: 'string',
              description: 'Verbatim line as seen on the source'
            },
            grainMm: {
              type: ['number', 'null'],
              description:
                'Szálirány / hosszúság mm (first dimension). Null if unreadable.'
            },
            crossMm: {
              type: ['number', 'null'],
              description:
                'Kereszt / szélesség mm (second dimension). Null if unreadable.'
            },
            quantity: {
              type: 'number',
              description: 'Darabszám; default 1 if missing'
            },
            quantityUncertain: { type: 'boolean' },
            dimsUncertain: {
              type: 'boolean',
              description: 'True if grain/cross digits are ambiguous'
            },
            confidence: {
              type: 'number',
              description: '0 to 1 self-assessed confidence for this line'
            },
            notes: {
              type: ['string', 'null'],
              description:
                'Rövid magyar megjegyzés (max ~100 karakter). Angol tilos.'
            }
          },
          required: [
            'rawText',
            'grainMm',
            'crossMm',
            'quantity',
            'quantityUncertain',
            'dimsUncertain',
            'confidence',
            'notes'
          ]
        }
      }
    },
    required: ['documentKind', 'warnings', 'lines']
  }
}

const SYSTEM_PROMPT = `You extract furniture panel (lapszabászat) size lists for a Hungarian workshop ERP.
Return ONLY via the extract_panel_dims tool.

Language (STRICT):
- warnings[] and notes MUST be Hungarian only. Never English.
- Keep them short (one sentence, ≤100 characters).
- rawText may keep verbatim characters from the source.

What to extract (ONLY):
- grainMm = hosszúság / szálirány in whole millimetres (first size)
- crossMm = szélesség / kereszt in whole millimetres (second size)
- quantity = darabszám (2, 2db, x2, ×2 → number). If missing → quantity=1 and quantityUncertain=true.

Do NOT put into structured fields: élzáró / ABS / edge codes, materials, markings/labels, prices. Those may remain inside rawText only.

Rules:
- One list row → one line.
- Formats like 720×560, 720 560 2, 800x400 x4, 600;400;1 are OK.
- Ignore headers, titles, addresses, struck-through rows, totals.
- Handwriting: be conservative. Lower confidence when digits are ambiguous (O/0, 1/7). Set dimsUncertain=true when unsure.
- confidence: 0.9+ clear print; 0.6–0.85 readable handwriting; <0.6 guessy.
- Max ${MAX_VISION_LINES} lines. Do not invent rows that are not on the image.`

function asNullableMm(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded <= 0) return null
  return rounded
}

/** Exportált normalize — unit teszthez / API bridge. */
export function normalizeVisionResult(
  input: Record<string, unknown>,
  model: string
): VisionParseResult {
  const kindRaw = String(input.documentKind || 'unknown')
  const allowed = new Set([
    'handwritten_list',
    'printed_table',
    'screenshot',
    'mixed',
    'unknown'
  ])
  const documentKind = (
    allowed.has(kindRaw) ? kindRaw : 'unknown'
  ) as VisionParseResult['documentKind']

  const warnings = Array.isArray(input.warnings)
    ? input.warnings
        .filter((w): w is string => typeof w === 'string')
        .map((w) => w.trim().slice(0, 160))
        .filter(Boolean)
        .slice(0, 8)
    : []

  const rawLines = Array.isArray(input.lines) ? input.lines : []
  const lines: VisionPanelLine[] = []
  for (const row of rawLines.slice(0, MAX_VISION_LINES)) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const rawText = typeof r.rawText === 'string' ? r.rawText.trim() : ''
    const grainMm = asNullableMm(r.grainMm)
    const crossMm = asNullableMm(r.crossMm)
    let quantity = Number(r.quantity)
    if (!Number.isFinite(quantity) || quantity < 1) quantity = 1
    quantity = Math.min(99999, Math.round(quantity))
    let confidence = Number(r.confidence)
    if (!Number.isFinite(confidence)) confidence = 0.5
    confidence = Math.max(0, Math.min(1, confidence))
    const quantityUncertain = Boolean(r.quantityUncertain)
    const dimsUncertain = Boolean(r.dimsUncertain)
    let notes =
      typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null
    if (notes) notes = notes.slice(0, 120)
    if (!rawText && grainMm == null && crossMm == null) continue
    lines.push({
      rawText: rawText || `${grainMm ?? '?'} × ${crossMm ?? '?'}`,
      grainMm,
      crossMm,
      quantity,
      quantityUncertain,
      dimsUncertain,
      confidence,
      notes
    })
  }

  return { documentKind, lines, warnings, model }
}

function toolInputFromMessage(
  message: Anthropic.Messages.Message
): Record<string, unknown> {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'extract_panel_dims') {
      return (block.input || {}) as Record<string, unknown>
    }
  }
  throw new Error('A modell nem adott strukturált méret-kimenetet')
}

export async function parsePanelImage(params: {
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}): Promise<VisionParseResult> {
  if (!params.base64 || params.base64.length < 32) {
    throw new Error('Érvénytelen kép')
  }
  if (params.base64.length > 14_000_000) {
    throw new Error('A kép túl nagy (max ~10 MB)')
  }

  const client = getClient()
  const message = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_panel_dims' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: params.mediaType,
              data: params.base64
            }
          },
          {
            type: 'text',
            text:
              'Olvasd ki a panel méretsorokat erről a fotóról/képernyőképről/szkennelt listáról. ' +
              'Csak szál mm, kereszt mm és darabszám. Élzárót és jelölést ne strukturáld. ' +
              'Lehet kézírás. warnings és notes kizárólag rövid magyar szöveg. ' +
              'Áthúzott sorokat hagyd ki.'
          }
        ]
      }
    ]
  })

  return normalizeVisionResult(toolInputFromMessage(message), VISION_MODEL)
}

export function detectImageMediaType(
  mime: string | null | undefined,
  filename?: string
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const m = (mime || '').toLowerCase()
  if (
    m === 'image/png' ||
    m === 'image/webp' ||
    m === 'image/gif' ||
    m === 'image/jpeg'
  ) {
    return m
  }
  const name = (filename || '').toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}
