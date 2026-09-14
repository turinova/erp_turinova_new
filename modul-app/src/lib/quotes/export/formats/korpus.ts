import ExcelJS from 'exceljs'

import type {
  BuildExcelResult,
  QuoteExportPanel
} from '@/lib/quotes/export/types'

function slugifyEquipmentName(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'export'
}

/** Main-app Korpus cutting-list Excel (1:1 layout + edge aggregation). */
export async function buildKorpusExcel(input: {
  quoteNumber: string
  equipmentName: string
  panels: QuoteExportPanel[]
}): Promise<BuildExcelResult> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Cutting List')

  worksheet.getColumn(1).width = 15
  worksheet.getColumn(2).width = 12
  worksheet.getColumn(3).width = 12
  worksheet.getColumn(4).width = 10
  worksheet.getColumn(5).width = 15
  worksheet.getColumn(6).width = 12
  worksheet.getColumn(7).width = 10
  worksheet.getColumn(8).width = 10
  worksheet.getColumn(9).width = 12
  worksheet.getColumn(10).width = 10
  worksheet.getColumn(11).width = 10
  worksheet.getColumn(12).width = 12
  worksheet.getColumn(13).width = 10
  worksheet.getColumn(14).width = 10
  worksheet.getColumn(15).width = 12
  worksheet.getColumn(16).width = 10
  worksheet.getColumn(17).width = 10
  worksheet.getColumn(18).width = 12

  const row1 = worksheet.getRow(1)
  row1.values = [
    'Bútorlap',
    '',
    '',
    '',
    '',
    '',
    'Élzárás 1',
    '',
    '',
    'Élzárás 2',
    '',
    '',
    'Élzárás 3',
    '',
    '',
    'Élzárás 4',
    '',
    ''
  ]

  worksheet.mergeCells('A1:F1')
  worksheet.mergeCells('G1:I1')
  worksheet.mergeCells('J1:L1')
  worksheet.mergeCells('M1:O1')
  worksheet.mergeCells('P1:R1')

  const row2 = worksheet.getRow(2)
  row2.values = [
    'Azonosító',
    'Hosszúság',
    'Szélesség',
    'Darab',
    'Megnevezés',
    'Forgatható?',
    'Hossz',
    'Szél',
    'Azon',
    'Hossz',
    'Szél',
    'Azon',
    'Hossz',
    'Szél',
    'Azon',
    'Hossz',
    'Szél',
    'Azon'
  ]

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11 },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE4E4E4' }
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    }
  }

  for (let col = 1; col <= 18; col++) {
    row1.getCell(col).style = headerStyle
    row2.getCell(col).style = headerStyle
  }
  row1.height = 20
  row2.height = 20

  const sortedPanels = [...input.panels].sort((a, b) => {
    const codeA = a.machineCode || ''
    const codeB = b.machineCode || ''
    if (!codeA && !codeB) return 0
    if (!codeA) return 1
    if (!codeB) return -1
    return codeA.localeCompare(codeB)
  })

  let currentRow = 3
  const dataStyle: Partial<ExcelJS.Style> = {
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    },
    alignment: {
      horizontal: 'center',
      vertical: 'middle'
    }
  }

  for (const panel of sortedPanels) {
    // Main parity: grain_direction true → not rotatable ('n')
    const rotatable = panel.grainDirection === true ? 'n' : 'i'

    // A=top, C=bottom, B=left, D=right (same order as main / cutting list)
    const edges = [
      panel.edgeACode,
      panel.edgeCCode,
      panel.edgeBCode,
      panel.edgeDCode
    ]

    const materialCounts: Record<string, { long: number; short: number }> = {}
    const longEdges = [0, 1]
    const shortEdges = [2, 3]

    edges.forEach((edgeCode, index) => {
      if (!edgeCode) return
      if (!materialCounts[edgeCode]) {
        materialCounts[edgeCode] = { long: 0, short: 0 }
      }
      if (longEdges.includes(index)) {
        materialCounts[edgeCode].long += 1
      } else if (shortEdges.includes(index)) {
        materialCounts[edgeCode].short += 1
      }
    })

    const rowValues: Array<string | number> = [
      panel.machineCode,
      panel.grainMm,
      panel.crossMm,
      panel.quantity,
      panel.label || '',
      rotatable
    ]

    let edgeIndex = 0
    for (const [materialCode, counts] of Object.entries(materialCounts)) {
      if (edgeIndex >= 4) break
      rowValues.push(counts.long, counts.short, materialCode)
      edgeIndex += 1
    }

    while (rowValues.length < 18) {
      rowValues.push('')
    }

    const row = worksheet.getRow(currentRow)
    row.values = rowValues
    for (let col = 1; col <= 18; col++) {
      row.getCell(col).style = dataStyle
    }
    currentRow += 1
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `quote_${input.quoteNumber}_${slugifyEquipmentName(input.equipmentName)}.xlsx`

  return {
    buffer: buffer as ArrayBuffer,
    filename,
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}
