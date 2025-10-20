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

    let successCount = 0
    let errorCount = 0
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      try {
        // Parse VAT and Currency
        const vatString = row['ÁFA']?.toString().trim()
        const currencyString = row['Pénznem']?.toString().trim()
        
        let vatId = vatString ? vatMap.get(vatString) : null
        let currencyId = currencyString ? currencyMap.get(currencyString) : null

        // Use defaults if not found
        if (!vatId && defaultVat) {
          vatId = defaultVat.id
        }
        if (!currencyId && defaultCurrency) {
          currencyId = defaultCurrency.id
        }

        const partnerData = {
          name: row['Név']?.toString().trim(),
          email: row['E-mail']?.toString().trim() || null,
          mobile: row['Telefon']?.toString().trim() || null,
          contact_person: row['Kapcsolattartó']?.toString().trim() || null,
          country: row['Ország']?.toString().trim() || null,
          postal_code: row['Irányítószám']?.toString().trim() || null,
          city: row['Város']?.toString().trim() || null,
          address: row['Cím']?.toString().trim() || null,
          tax_number: row['Adószám']?.toString().trim() || null,
          company_registration_number: row['Cégjegyzékszám']?.toString().trim() || null,
          bank_account: row['Bankszámlaszám']?.toString().trim() || null,
          payment_terms: parseInt(row['Fizetési határidő']) || 30,
          status: row['Státusz']?.toString().trim() || 'active',
          vat_id: vatId,
          currency_id: currencyId,
          notes: row['Megjegyzés']?.toString().trim() || null
        }

        // Validate required field
        if (!partnerData.name) {
          errors.push(`Sor ${rowNum}: Hiányzó kötelező mező (Név)`)
          errorCount++
          continue
        }

        const existingId = nameMap.get(partnerData.name.toLowerCase())

        if (existingId) {
          // Update existing partner
          await supabaseServer.from('partners').update(partnerData).eq('id', existingId)
        } else {
          // Create new partner
          await supabaseServer.from('partners').insert(partnerData)
        }

        successCount++

      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        errorCount++
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Import completed with errors', 
        details: errors,
        successCount,
        errorCount 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      message: 'Import successful', 
      successCount,
      errorCount: 0 
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

