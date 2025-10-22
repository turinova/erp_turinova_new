import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])

    // Fetch existing partners by name
    const { data: existingPartners } = await supabaseServer
      .from('partners')
      .select('id, name')
      .is('deleted_at', null)

    const nameMap = new Map(existingPartners?.map(p => [p.name.toLowerCase(), p.id]) || [])

    // Fetch reference data for VAT and currencies
    const { data: vatRates } = await supabaseServer.from('vat').select('id, name, kulcs').is('deleted_at', null)
    const { data: currencies } = await supabaseServer.from('currencies').select('id, name').is('deleted_at', null)

    const vatMap = new Map(vatRates?.map(v => [`${v.name} (${v.kulcs}%)`, v.id]) || [])
    const currencyMap = new Map(currencies?.map(c => [c.name, c.id]) || [])

    // Get default VAT (27%) and Currency (HUF)
    const defaultVat = vatRates?.find(v => v.kulcs === 27)
    const defaultCurrency = currencies?.find(c => c.name === 'HUF' || c.name === 'Forint')

    const preview = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      const requiredFields = {
        'Név': row['Név']
      }

      const missing = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k, _]) => k)
      if (missing.length > 0) {
        errors.push(`Sor ${rowNum}: Hiányzó kötelező mező: ${missing.join(', ')}`)
        continue
      }

      const name = row['Név']?.toString().trim()
      const action = nameMap.has(name.toLowerCase()) ? 'Frissítés' : 'Új'

      preview.push({
        row: rowNum,
        action,
        name,
        email: row['E-mail']?.toString().trim() || '',
        mobile: row['Telefon']?.toString().trim() || '',
        contactPerson: row['Kapcsolattartó']?.toString().trim() || '',
        country: row['Ország']?.toString().trim() || '',
        postalCode: row['Irányítószám']?.toString().trim() || '',
        city: row['Város']?.toString().trim() || '',
        address: row['Cím']?.toString().trim() || '',
        taxNumber: row['Adószám']?.toString().trim() || '',
        companyRegistrationNumber: row['Cégjegyzékszám']?.toString().trim() || '',
        bankAccount: row['Bankszámlaszám']?.toString().trim() || '',
        paymentTerms: parseInt(row['Fizetési határidő']) || 30,
        status: row['Státusz']?.toString().trim() || 'active',
        vat: row['ÁFA']?.toString().trim() || '',
        currency: row['Pénznem']?.toString().trim() || '',
        notes: row['Megjegyzés']?.toString().trim() || ''
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Validation errors', 
        details: errors 
      }, { status: 400 })
    }

    return NextResponse.json({ preview })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 })
  }
}

