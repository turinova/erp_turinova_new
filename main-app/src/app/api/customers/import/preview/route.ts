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

    // Fetch existing customers by email and name
    const { data: existingCustomers } = await supabaseServer
      .from('customers')
      .select('id, email, name')
      .is('deleted_at', null)

    const emailMap = new Map(existingCustomers?.filter(c => c.email).map(c => [c.email.toLowerCase(), c.id]) || [])
    const nameMap = new Map(existingCustomers?.map(c => [c.name.toLowerCase(), c.id]) || [])

    const preview = []
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      // Only name is required now
      const requiredFields = {
        'Név': row['Név']
      }

      const missing = Object.entries(requiredFields).filter(([_, v]) => !v).map(([k, _]) => k)
      if (missing.length > 0) {
        errors.push(`Sor ${rowNum}: Hiányzó kötelező mezők: ${missing.join(', ')}`)
        continue
      }

      // Handle email field - allow null/empty emails
      const emailValue = row['E-mail']?.toString().trim()
      const customerEmail = emailValue && emailValue.length > 0 ? emailValue : null
      const customerName = row['Név']?.toString().trim()
      
      // Determine action: check by email first, then by name if no email
      let action = 'Új'
      if (customerEmail && emailMap.has(customerEmail.toLowerCase())) {
        action = 'Frissítés'
      } else if (!customerEmail && customerName && nameMap.has(customerName.toLowerCase())) {
        action = 'Frissítés'
      }

      // Parse SMS notification value
      const smsValue = row['SMS']?.toString().trim().toLowerCase()
      const smsNotification = smsValue === 'igen' || smsValue === 'yes' || smsValue === 'true' || smsValue === '1'

      preview.push({
        row: rowNum,
        action,
        name: customerName,
        email: customerEmail || '', // Show empty string in preview if no email
        mobile: row['Telefon']?.toString().trim() || '',
        discountPercent: parseFloat(row['Kedvezmény (%)']) || 0,
        smsNotification,
        billingName: row['Számlázási név']?.toString().trim() || '',
        billingCountry: row['Ország']?.toString().trim() || 'Magyarország',
        billingCity: row['Város']?.toString().trim() || '',
        billingPostalCode: row['Irányítószám']?.toString().trim() || '',
        billingStreet: row['Utca']?.toString().trim() || '',
        billingHouseNumber: row['Házszám']?.toString().trim() || '',
        billingTaxNumber: row['Adószám']?.toString().trim() || '',
        billingCompanyRegNumber: row['Cégjegyzékszám']?.toString().trim() || ''
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

