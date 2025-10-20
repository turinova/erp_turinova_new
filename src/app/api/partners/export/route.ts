import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const { data: partners, error } = await supabaseServer
      .from('partners')
      .select(`
        *,
        vat (name, kulcs),
        currencies (name)
      `)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch partners', details: error.message }, { status: 500 })
    }

    // Transform for Excel with all fields
    const excelData = partners?.map(partner => {
      return {
        'Név': partner.name,
        'E-mail': partner.email || '',
        'Telefon': partner.mobile || '',
        'Kapcsolattartó': partner.contact_person || '',
        'Ország': partner.country || '',
        'Irányítószám': partner.postal_code || '',
        'Város': partner.city || '',
        'Cím': partner.address || '',
        'Adószám': partner.tax_number || '',
        'Cégjegyzékszám': partner.company_registration_number || '',
        'Bankszámlaszám': partner.bank_account || '',
        'Fizetési határidő': partner.payment_terms || 30,
        'Státusz': partner.status || 'active',
        'ÁFA': partner.vat ? `${partner.vat.name} (${partner.vat.kulcs}%)` : '',
        'Pénznem': partner.currencies?.name || '',
        'Megjegyzés': partner.notes || ''
      }
    }) || []

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Partners')

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Név
      { wch: 30 }, // E-mail
      { wch: 15 }, // Telefon
      { wch: 25 }, // Kapcsolattartó
      { wch: 15 }, // Ország
      { wch: 12 }, // Irányítószám
      { wch: 20 }, // Város
      { wch: 30 }, // Cím
      { wch: 20 }, // Adószám
      { wch: 20 }, // Cégjegyzékszám
      { wch: 25 }, // Bankszámlaszám
      { wch: 15 }, // Fizetési határidő
      { wch: 12 }, // Státusz
      { wch: 20 }, // ÁFA
      { wch: 12 }, // Pénznem
      { wch: 40 }  // Megjegyzés
    ]

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="partners.xlsx"'
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

