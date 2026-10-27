/**
 * Opti panel szöveges import — csak Szál / Kereszt / Db.
 * Él és jelölés nem importálódik (form aktuális éljei a commitnál).
 * Doc: docs/47-opti-panel-import.md
 */

export type ParsedPanelRowStatus = 'ok' | 'warn' | 'error'

export type ParsedPanelRow = {
  grainMm: number | null
  crossMm: number | null
  quantity: number
  sourceLine: number
  sourceText: string
  status: ParsedPanelRowStatus
  issues: string[]
}

export type PanelTextImportOptions = {
  maxGrainMm: number | null
  maxCrossMm: number | null
}

const MAX_ROWS = 500

function computeStatus(
  grainMm: number | null,
  crossMm: number | null,
  issues: string[]
): ParsedPanelRowStatus {
  const hasHardError = issues.some(
    (msg) =>
      msg.includes('Kell szál') ||
      msg.includes('0-nál nagyobb') ||
      msg.includes('darabszám') ||
      msg.includes('egész mm') ||
      msg.includes('max ')
  )
  if (hasHardError || grainMm == null || crossMm == null) return 'error'
  if (issues.length > 0) return 'warn'
  return 'ok'
}

export function recomputeParsedRow(
  row: ParsedPanelRow,
  options: PanelTextImportOptions
): ParsedPanelRow {
  // Dim-issue-ket újraszámoljuk; AI / egyéb soft note-ok megmaradnak,
  // amíg a UI szerkesztésnél ki nem üríti az issues tömböt.
  const issues = row.issues.filter(
    (msg) =>
      !msg.includes('Kell szál') &&
      !msg.includes('0-nál nagyobb') &&
      !msg.startsWith('Szál max') &&
      !msg.startsWith('Kereszt max') &&
      !msg.includes('A darabszám legalább') &&
      !msg.includes('egész mm')
  )

  if (row.grainMm == null || row.crossMm == null) {
    issues.push('Kell szál és kereszt mm')
  } else if (row.grainMm <= 0 || row.crossMm <= 0) {
    issues.push('A méret legyen 0-nál nagyobb')
  }
  if (!Number.isInteger(row.quantity) || row.quantity < 1) {
    issues.push('A darabszám legalább 1')
  }
  if (
    row.grainMm != null &&
    options.maxGrainMm != null &&
    row.grainMm > options.maxGrainMm
  ) {
    issues.push(`Szál max ${options.maxGrainMm} mm`)
  }
  if (
    row.crossMm != null &&
    options.maxCrossMm != null &&
    row.crossMm > options.maxCrossMm
  ) {
    issues.push(`Kereszt max ${options.maxCrossMm} mm`)
  }

  return {
    ...row,
    issues,
    status: computeStatus(row.grainMm, row.crossMm, issues)
  }
}

/**
 * Egy sor: Szál Kereszt [Db]. `|` utáni rész (él) figyelmen kívül.
 * Nem szám tokenek (jelölés) figyelmen kívül.
 */
export function parsePanelTextLine(
  line: string,
  sourceLine: number
): Omit<ParsedPanelRow, 'status'> {
  const sourceText = line.trim()
  const issues: string[] = []
  if (!sourceText) {
    return {
      grainMm: null,
      crossMm: null,
      quantity: 1,
      sourceLine,
      sourceText,
      issues: ['Üres sor']
    }
  }

  const pipeIdx = sourceText.indexOf('|')
  const dimRaw =
    pipeIdx === -1 ? sourceText : sourceText.slice(0, pipeIdx).trim()

  const normalized = dimRaw
    .replace(/[×xX*]/g, ' ')
    .replace(/[;,]/g, ' ')
    .replace(/—/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = normalized.split(' ').filter(Boolean)
  const nums: number[] = []
  let qtyFromX: number | null = null

  for (const token of tokens) {
    const xQty = token.match(/^x(\d+)$/i)
    if (xQty) {
      qtyFromX = Number.parseInt(xQty[1]!, 10)
      continue
    }
    if (/^(db|db\.)$/i.test(token)) continue
    if (/^\d+$/.test(token)) {
      nums.push(Number.parseInt(token, 10))
      continue
    }
    if (/^\d+[.,]\d+$/.test(token)) {
      issues.push(`Csak egész mm: „${token}”`)
      continue
    }
    // jelölés / egyéb szöveg — import scope: ignorál
  }

  const grainMm = nums[0] ?? null
  const crossMm = nums[1] ?? null
  let quantity = 1
  if (nums.length >= 3) {
    quantity = nums[2]!
  } else if (qtyFromX != null) {
    quantity = qtyFromX
  }

  if (grainMm == null || crossMm == null) {
    issues.push('Kell szál és kereszt mm')
  } else if (grainMm <= 0 || crossMm <= 0) {
    issues.push('A méret legyen 0-nál nagyobb')
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    issues.push('A darabszám legalább 1')
    quantity = 1
  }

  return {
    grainMm,
    crossMm,
    quantity,
    sourceLine,
    sourceText,
    issues
  }
}

export function parsePanelTextImport(
  text: string,
  options: PanelTextImportOptions
): ParsedPanelRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows: ParsedPanelRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    if (!raw.trim()) continue
    if (rows.length >= MAX_ROWS) break

    const parsed = parsePanelTextLine(raw, i + 1)
    rows.push(
      recomputeParsedRow(
        {
          ...parsed,
          status: 'ok'
        },
        options
      )
    )
  }

  return rows
}

/** Vision / Anthropic sorok → előnézet sorok (dim + qty only). */
export function visionLinesToParsedRows(
  lines: Array<{
    grainMm: number | null
    crossMm: number | null
    quantity: number
    quantityUncertain?: boolean
    dimsUncertain?: boolean
    confidence?: number
    rawText?: string
    notes?: string | null
  }>,
  options: PanelTextImportOptions
): ParsedPanelRow[] {
  const MAX_VISION = 200
  return lines.slice(0, MAX_VISION).map((line, index) => {
    const issues: string[] = []
    if (line.dimsUncertain || (line.confidence != null && line.confidence < 0.7)) {
      issues.push('AI bizonytalan méret — ellenőrizd')
    }
    if (line.quantityUncertain) {
      issues.push('Darabszám bizonytalan — ellenőrizd')
    }
    if (line.notes?.trim()) {
      issues.push(line.notes.trim().slice(0, 120))
    }
    return recomputeParsedRow(
      {
        grainMm: line.grainMm,
        crossMm: line.crossMm,
        quantity:
          Number.isInteger(line.quantity) && line.quantity >= 1
            ? line.quantity
            : 1,
        sourceLine: index + 1,
        sourceText: (line.rawText ?? '').trim() || '—',
        status: 'ok',
        issues
      },
      options
    )
  })
}

export const PANEL_TEXT_IMPORT_EXAMPLES = [
  '720 560 2',
  '800x400 x4',
  '600;400;1',
  '720 560'
] as const
