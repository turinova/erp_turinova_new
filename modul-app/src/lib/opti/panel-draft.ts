/** Opti panel — local draft (nincs DB mentés). */

export type OptiPanelDraft = {
  id: string
  sheetMaterialId: string
  sheetMaterialName: string
  grainMm: number
  crossMm: number
  quantity: number
  marking: string
  edgeAId: string | null
  edgeBId: string | null
  edgeCId: string | null
  edgeDId: string | null
  edgeALabel: string
  edgeBLabel: string
  edgeCLabel: string
  edgeDLabel: string
}

export function createPanelDraft(input: {
  sheetMaterialId: string
  sheetMaterialName: string
  grainMm: number
  crossMm: number
  quantity: number
  marking: string
  edgeAId: string
  edgeBId: string
  edgeCId: string
  edgeDId: string
  edgeALabel: string
  edgeBLabel: string
  edgeCLabel: string
  edgeDLabel: string
}): OptiPanelDraft {
  return {
    id: crypto.randomUUID(),
    sheetMaterialId: input.sheetMaterialId,
    sheetMaterialName: input.sheetMaterialName,
    grainMm: input.grainMm,
    crossMm: input.crossMm,
    quantity: input.quantity,
    marking: input.marking.trim(),
    edgeAId: input.edgeAId || null,
    edgeBId: input.edgeBId || null,
    edgeCId: input.edgeCId || null,
    edgeDId: input.edgeDId || null,
    edgeALabel: input.edgeALabel,
    edgeBLabel: input.edgeBLabel,
    edgeCLabel: input.edgeCLabel,
    edgeDLabel: input.edgeDLabel
  }
}

/** Él szín — ugyanaz a hash logika, mint a main-app Opti előnézetben. */
export function edgeMaterialColor(edgeMaterialId: string | null | undefined): string {
  if (!edgeMaterialId) return '#94a3b8'

  const colors = [
    '#18181B',
    '#16a34a',
    '#ea580c',
    '#dc2626',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#78716c',
    '#475569',
    '#ca8a04'
  ]

  const hash = edgeMaterialId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
