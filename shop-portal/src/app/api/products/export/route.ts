import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import * as XLSX from 'xlsx'

/**
 * POST /api/products/export
 * Export products to Excel with selected fields
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productIds, fields } = body

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: 'No fields selected for export' }, { status: 400 })
    }

    // SKU is always required
    if (!fields.includes('sku')) {
      return NextResponse.json({ error: 'SKU is required for export' }, { status: 400 })
    }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all products with pagination to handle Supabase's 1000 record limit
    let allProducts: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      
      // Build query for each page (need to rebuild to avoid query reuse issues)
      let query = supabase
        .from('shoprenter_products')
        .select(`
          id,
          sku,
          model_number,
          gtin,
          name,
          cost,
          multiplier,
          price,
          gross_price,
          status
        `)
        .is('deleted_at', null)
        .order('sku', { ascending: true })
        .range(from, to)

      // If productIds provided, filter by them (otherwise export all)
      if (productIds && Array.isArray(productIds) && productIds.length > 0) {
        query = query.in('id', productIds)
      }

      const { data: products, error: productsError } = await query

      if (productsError) {
        console.error('Error fetching products:', productsError)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
      }

      if (products && products.length > 0) {
        allProducts = allProducts.concat(products)
        // If we got less than pageSize, we've reached the end
        hasMore = products.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }

    const products = allProducts

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 })
    }

    // Map field names to Hungarian labels
    const fieldLabels: Record<string, string> = {
      sku: 'SKU',
      model_number: 'Gyártói cikkszám',
      gtin: 'Vonalkód',
      name: 'Termék neve',
      cost: 'Beszerzési ár',
      multiplier: 'Árazási szorzó',
      price: 'Nettó ár',
      gross_price: 'Bruttó ár',
      status: 'Aktív'
    }

    // Prepare Excel data with only selected fields
    const excelData = products.map((product: any) => {
      const row: Record<string, any> = {}
      
      fields.forEach((field: string) => {
        const label = fieldLabels[field] || field
        let value = product[field]
        
        // Format values appropriately
        if (field === 'cost' && value !== null && value !== undefined) {
          value = parseFloat(value.toString())
        } else if (field === 'multiplier' && value !== null && value !== undefined) {
          value = parseFloat(value.toString())
        } else if (field === 'price' && value !== null && value !== undefined) {
          value = parseFloat(value.toString())
        } else if (field === 'gross_price' && value !== null && value !== undefined) {
          value = parseFloat(value.toString())
        } else if (field === 'status') {
          // Convert status: 1 = Aktív, 0 = Inaktív
          value = value === 1 || value === '1' ? 'Aktív' : 'Inaktív'
        } else if (value === null || value === undefined) {
          value = ''
        }
        
        row[label] = value
      })
      
      return row
    })

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths based on field type
    const columnWidths: Record<string, number> = {
      'SKU': 20,
      'Gyártói cikkszám': 20,
      'Vonalkód': 15,
      'Termék neve': 40,
      'Beszerzési ár': 15,
      'Árazási szorzó': 15,
      'Nettó ár': 15,
      'Bruttó ár': 15,
      'Aktív': 12
    }

    ws['!cols'] = fields.map((field: string) => {
      const label = fieldLabels[field] || field
      return { wch: columnWidths[label] || 15 }
    })

    XLSX.utils.book_append_sheet(wb, ws, 'Termékek')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `termekek_export_${timestamp}.xlsx`

    console.log(`Export complete: ${filename} (${products.length} products, ${fields.length} fields)`)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error in products export:', error)
    return NextResponse.json({ 
      error: 'Export failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
