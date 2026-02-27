import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get quote with panels data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        quote_number,
        quote_panels (
          id,
          material_id,
          width_mm,
          height_mm,
          quantity,
          label,
          edge_material_a_id,
          edge_material_b_id,
          edge_material_c_id,
          edge_material_d_id
        )
      `)
      .eq('id', quoteId)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Get material machine codes for all materials in this quote
    const materialIds = quote.quote_panels?.map(p => p.material_id) || []
    const { data: materialMaps } = await supabase
      .from('machine_material_map')
      .select('material_id, machine_code')
      .in('material_id', materialIds)
      .eq('machine_type', 'Korpus')

    // Get edge material machine codes
    const edgeMaterialIds = quote.quote_panels?.flatMap(p => [
      p.edge_material_a_id,
      p.edge_material_b_id,
      p.edge_material_c_id,
      p.edge_material_d_id
    ].filter(Boolean)) || []
    
    const { data: edgeMaterialMaps } = await supabase
      .from('machine_edge_material_map')
      .select('edge_material_id, machine_code')
      .in('edge_material_id', edgeMaterialIds)
      .eq('machine_type', 'Korpus')

    // Get grain_direction from quote_materials_pricing
    const { data: materialPricing } = await supabase
      .from('quote_materials_pricing')
      .select('material_id, grain_direction')
      .eq('quote_id', quoteId)

    // Create lookup maps
    const materialCodeMap = new Map(
      materialMaps?.map(m => [m.material_id, m.machine_code]) || []
    )
    const edgeCodeMap = new Map(
      edgeMaterialMaps?.map(e => [e.edge_material_id, e.machine_code]) || []
    )
    const grainDirectionMap = new Map(
      materialPricing?.map(p => [p.material_id, p.grain_direction]) || []
    )

    // Create new workbook and worksheet
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Cutting List')

    // Set column widths
    worksheet.getColumn(1).width = 15  // A
    worksheet.getColumn(2).width = 12  // B
    worksheet.getColumn(3).width = 12  // C
    worksheet.getColumn(4).width = 10  // D
    worksheet.getColumn(5).width = 15  // E
    worksheet.getColumn(6).width = 12  // F
    worksheet.getColumn(7).width = 10  // G (Élzárás 1 - Hossz)
    worksheet.getColumn(8).width = 10  // H (Élzárás 1 - Szél)
    worksheet.getColumn(9).width = 12  // I (Élzárás 1 - Azon)
    worksheet.getColumn(10).width = 10 // J (Élzárás 2 - Hossz)
    worksheet.getColumn(11).width = 10 // K (Élzárás 2 - Szél)
    worksheet.getColumn(12).width = 12 // L (Élzárás 2 - Azon)
    worksheet.getColumn(13).width = 10 // M (Élzárás 3 - Hossz)
    worksheet.getColumn(14).width = 10 // N (Élzárás 3 - Szél)
    worksheet.getColumn(15).width = 12 // O (Élzárás 3 - Azon)
    worksheet.getColumn(16).width = 10 // P (Élzárás 4 - Hossz)
    worksheet.getColumn(17).width = 10 // Q (Élzárás 4 - Szél)
    worksheet.getColumn(18).width = 12 // R (Élzárás 4 - Azon)

    // Row 1: Main headers
    const row1 = worksheet.getRow(1)
    row1.values = [
      'Bútorlap', '', '', '', '', '',           // A-F: Bútorlap section
      'Élzárás 1', '', '',                      // G-I: Élzárás 1 section
      'Élzárás 2', '', '',                      // J-L: Élzárás 2 section
      'Élzárás 3', '', '',                      // M-O: Élzárás 3 section
      'Élzárás 4', '', ''                       // P-R: Élzárás 4 section
    ]

    // Merge cells for main headers
    worksheet.mergeCells('A1:F1') // Bútorlap
    worksheet.mergeCells('G1:I1') // Élzárás 1
    worksheet.mergeCells('J1:L1') // Élzárás 2
    worksheet.mergeCells('M1:O1') // Élzárás 3
    worksheet.mergeCells('P1:R1') // Élzárás 4

    // Row 2: Sub-headers
    const row2 = worksheet.getRow(2)
    row2.values = [
      'Azonosító',      // A
      'Hosszúság',      // B
      'Szélesség',      // C
      'Darab',          // D
      'Megnevezés',     // E
      'Forgatható?',    // F
      'Hossz',          // G - Élzárás 1
      'Szél',           // H
      'Azon',           // I
      'Hossz',          // J - Élzárás 2
      'Szél',           // K
      'Azon',           // L
      'Hossz',          // M - Élzárás 3
      'Szél',           // N
      'Azon',           // O
      'Hossz',          // P - Élzárás 4
      'Szél',           // Q
      'Azon'            // R
    ]

    // Style for headers
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

    // Apply styles to row 1
    for (let col = 1; col <= 18; col++) {
      const cell = row1.getCell(col)
      cell.style = headerStyle
    }

    // Apply styles to row 2
    for (let col = 1; col <= 18; col++) {
      const cell = row2.getCell(col)
      cell.style = headerStyle
    }

    // Set row heights
    row1.height = 20
    row2.height = 20

    // Add data rows starting from row 3
    let currentRow = 3
    const panels = quote.quote_panels || []

    // Sort panels by Azonosító (machine_code) in ascending order
    const sortedPanels = [...panels].sort((a, b) => {
      // Get machine codes for comparison
      const codeA = materialCodeMap.get(a.material_id) || ''
      const codeB = materialCodeMap.get(b.material_id) || ''
      
      // Empty codes go to the end
      if (!codeA && !codeB) return 0
      if (!codeA) return 1
      if (!codeB) return -1
      
      // Sort alphabetically by machine code (Azonosító) in ascending order
      return codeA.localeCompare(codeB)
    })

    sortedPanels.forEach((panel) => {
      // Get machine code for this material
      const machineCode = materialCodeMap.get(panel.material_id) || ''
      
      // Get grain direction (rotatable) - lowercase + switched logic
      const grainDirection = grainDirectionMap.get(panel.material_id)
      const rotatable = grainDirection === true ? 'n' : 'i'

      // Collect edges: A=top, B=left, C=bottom, D=right
      const edges = [
        panel.edge_material_a_id || null,  // Top (hosszu_also)
        panel.edge_material_c_id || null,  // Bottom (hosszu_felso) - SWAPPED
        panel.edge_material_b_id || null,  // Left (szeles_bal) - SWAPPED
        panel.edge_material_d_id || null   // Right (szeles_jobb)
      ]

      // Calculate edge banding following PHP logic
      const materialCounts: Record<string, { long: number; short: number }> = {}
      
      // Define long and short edges (0-based index)
      const longEdges = [0, 1]   // A (top), C (bottom)
      const shortEdges = [2, 3]  // B (left), D (right)

      // Count occurrences of each material
      edges.forEach((edgeMaterialId, index) => {
        if (edgeMaterialId) {
          const edgeCode = edgeCodeMap.get(edgeMaterialId) || edgeMaterialId
          
          if (!materialCounts[edgeCode]) {
            materialCounts[edgeCode] = { long: 0, short: 0 }
          }

          if (longEdges.includes(index)) {
            materialCounts[edgeCode].long += 1
          } else if (shortEdges.includes(index)) {
            materialCounts[edgeCode].short += 1
          }
        }
      })

      // Prepare row data
      const row = worksheet.getRow(currentRow)
      const rowValues: any[] = [
        machineCode,           // A: Azonosító (machine_code)
        panel.width_mm,        // B: Hosszúság
        panel.height_mm,       // C: Szélesség
        panel.quantity,        // D: Darab
        panel.label || '',     // E: Megnevezés (jelölés/label)
        rotatable              // F: Forgatható? (I=true, N=false)
      ]

      // Add edge banding data (up to 4 materials)
      let edgeIndex = 0
      for (const [materialCode, counts] of Object.entries(materialCounts)) {
        if (edgeIndex < 4) {
          rowValues.push(
            counts.long,      // Hossz (count of long edges with this material)
            counts.short,     // Szél (count of short edges with this material)
            materialCode      // Azon (edge material machine code)
          )
          edgeIndex++
        }
      }

      // Fill remaining edge columns with empty strings
      while (rowValues.length < 18) {
        rowValues.push('')
      }

      row.values = rowValues

      // Apply data style
      const dataStyle = {
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

      for (let col = 1; col <= 18; col++) {
        const cell = row.getCell(col)
        cell.style = dataStyle
      }

      currentRow++
    })

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Create response with Excel file
    const filename = `quote_${quote.quote_number}.xlsx`
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error generating Excel:', error)
    return NextResponse.json(
      { error: 'Failed to generate Excel file' },
      { status: 500 }
    )
  }
}

