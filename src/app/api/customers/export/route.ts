import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { data: customers, error } = await supabaseServer
      .from('customers')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch customers', details: error.message }, { status: 500 })
    }

    // Transform for Excel with all fields
    const excelData = customers?.map(customer => {
      return {
        'Név': customer.name,
        'E-mail': customer.email,
        'Telefon': customer.mobile || '',
        'Kedvezmény (%)': customer.discount_percent || 0,
        'Számlázási név': customer.billing_name || '',
        'Ország': customer.billing_country || '',
        'Város': customer.billing_city || '',
        'Irányítószám': customer.billing_postal_code || '',
        'Utca': customer.billing_street || '',
        'Házszám': customer.billing_house_number || '',
        'Adószám': customer.billing_tax_number || '',
        'Cégjegyzékszám': customer.billing_company_reg_number || ''
      }
    }) || []

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Név
      { wch: 30 }, // E-mail
      { wch: 15 }, // Telefon
      { wch: 12 }, // Kedvezmény (%)
      { wch: 30 }, // Számlázási név
      { wch: 15 }, // Ország
      { wch: 20 }, // Város
      { wch: 12 }, // Irányítószám
      { wch: 25 }, // Utca
      { wch: 10 }, // Házszám
      { wch: 20 }, // Adószám
      { wch: 20 }  // Cégjegyzékszám
    ]

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="customers.xlsx"'
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

