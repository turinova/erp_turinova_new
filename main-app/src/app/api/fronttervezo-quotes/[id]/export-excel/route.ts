import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

import { getFronttervezoQuoteById } from '@/lib/supabase-server'

function sanitizeFilenamePart(name: string): string {
  return name
    .trim()
    .replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ.]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
}

type LineRow = {
  display_name: string
  height_mm: number
  width_mm: number
  quantity: number
  sort_order?: number
}

/**
 * GET /api/fronttervezo-quotes/[id]/export-excel
 * Színönként külön xlsx: Magasság | Szélesség | Mennyiség
 * Válasz: { files: [{ filename, contentBase64 }] }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const quote = await getFronttervezoQuoteById(quoteId)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const lines = (quote.lines || []) as LineRow[]

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Nincs exportálható tétel' }, { status: 400 })
    }

    const byColor = new Map<string, LineRow[]>()

    for (const line of lines) {
      const color = (line.display_name || 'Ismeretlen').trim() || 'Ismeretlen'
      if (!byColor.has(color)) byColor.set(color, [])
      byColor.get(color)!.push(line)
    }

    const customerName =
      quote.customer?.billing_name || quote.customer?.name || quote.quote_number
    const customerPart = sanitizeFilenamePart(customerName)

    const headerStyle = {
      font: { bold: true, size: 11 },
      fill: {
        type: 'pattern' as const,
        pattern: 'solid' as const,
        fgColor: { argb: 'FFE4E4E4' }
      },
      border: {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      },
      alignment: {
        horizontal: 'center' as const,
        vertical: 'middle' as const
      }
    }

    const files: Array<{ filename: string; contentBase64: string }> = []

    for (const [color, colorLines] of byColor) {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(color.slice(0, 31) || 'Front')

      worksheet.getColumn(1).width = 14
      worksheet.getColumn(2).width = 14
      worksheet.getColumn(3).width = 14

      const headerRow = worksheet.getRow(1)
      headerRow.values = ['Magasság', 'Szélesség', 'Mennyiség']
      for (let col = 1; col <= 3; col++) {
        headerRow.getCell(col).style = headerStyle
      }
      headerRow.height = 20

      colorLines.forEach((line, index) => {
        const row = worksheet.getRow(index + 2)
        row.values = [line.height_mm, line.width_mm, line.quantity]
        row.getCell(1).alignment = { horizontal: 'right' }
        row.getCell(2).alignment = { horizontal: 'right' }
        row.getCell(3).alignment = { horizontal: 'right' }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const contentBase64 = Buffer.from(buffer).toString('base64')
      const colorPart = sanitizeFilenamePart(color) || 'szin'
      const filename = `NETT-FQ-${customerPart}-${colorPart}.xlsx`

      files.push({ filename, contentBase64 })
    }

    return NextResponse.json({
      success: true,
      files,
      count: files.length
    })
  } catch (error) {
    console.error('[fronttervezo export-excel]', error)
    return NextResponse.json(
      {
        error: 'Excel generálás sikertelen',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
