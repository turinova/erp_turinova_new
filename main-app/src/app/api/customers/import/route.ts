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

    // Fetch existing customers by email
    const { data: existingCustomers } = await supabaseServer
      .from('customers')
      .select('id, email')
      .is('deleted_at', null)

    const emailMap = new Map(existingCustomers?.map(c => [c.email.toLowerCase(), c.id]) || [])

    let successCount = 0
    let errorCount = 0
    const errors = []

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i]
      const rowNum = i + 2

      try {
        // Parse SMS notification value
        const smsValue = row['SMS']?.toString().trim().toLowerCase()
        const smsNotification = smsValue === 'igen' || smsValue === 'yes' || smsValue === 'true' || smsValue === '1'

        const customerData = {
          name: row['Név']?.toString().trim(),
          email: row['E-mail']?.toString().trim(),
          mobile: row['Telefon']?.toString().trim() || null,
          discount_percent: parseFloat(row['Kedvezmény (%)']) || 0,
          sms_notification: smsNotification,
          billing_name: row['Számlázási név']?.toString().trim() || null,
          billing_country: row['Ország']?.toString().trim() || 'Magyarország',
          billing_city: row['Város']?.toString().trim() || null,
          billing_postal_code: row['Irányítószám']?.toString().trim() || null,
          billing_street: row['Utca']?.toString().trim() || null,
          billing_house_number: row['Házszám']?.toString().trim() || null,
          billing_tax_number: row['Adószám']?.toString().trim() || null,
          billing_company_reg_number: row['Cégjegyzékszám']?.toString().trim() || null
        }

        // Validate required fields
        if (!customerData.name || !customerData.email) {
          errors.push(`Sor ${rowNum}: Hiányzó kötelező mezők (Név, E-mail)`)
          errorCount++
          continue
        }

        const existingId = emailMap.get(customerData.email.toLowerCase())

        if (existingId) {
          // Update existing customer
          await supabaseServer.from('customers').update(customerData).eq('id', existingId)
        } else {
          // Create new customer
          await supabaseServer.from('customers').insert(customerData)
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

