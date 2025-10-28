import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    console.log('=== CUSTOMER IMPORT STARTED ===')
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
    
    console.log(`Processing ${data.length} rows from Excel file`)

    // Fetch existing customers by email and name
    const { data: existingCustomers } = await supabaseServer
      .from('customers')
      .select('id, email, name')
      .is('deleted_at', null)

    const emailMap = new Map(existingCustomers?.filter(c => c.email).map(c => [c.email.toLowerCase(), c.id]) || [])
    const nameMap = new Map(existingCustomers?.map(c => [c.name.toLowerCase(), c.id]) || [])

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

        // Handle email field - allow null/empty emails
        const emailValue = row['E-mail']?.toString().trim()
        const customerEmail = emailValue && emailValue.length > 0 ? emailValue : null

        const customerData = {
          name: row['Név']?.toString().trim(),
          email: customerEmail,
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

        // Validate required fields - only name is required now
        if (!customerData.name) {
          errors.push(`Sor ${rowNum}: Hiányzó kötelező mező (Név)`)
          errorCount++
          continue
        }

        // Check for existing customer by email first, then by name if no email
        let existingId = null
        if (customerData.email) {
          existingId = emailMap.get(customerData.email.toLowerCase())
        } else {
          // If no email, check by name to avoid duplicates
          existingId = nameMap.get(customerData.name.toLowerCase())
        }

        if (existingId) {
          // Update existing customer
          console.log(`Updating existing customer: ${customerData.name}`)
          const { error: updateError } = await supabaseServer
            .from('customers')
            .update(customerData)
            .eq('id', existingId)
          
          if (updateError) {
            console.error(`Update error for ${customerData.name}:`, updateError)
            throw new Error(`Update failed: ${updateError.message}`)
          }
          console.log(`Successfully updated customer: ${customerData.name}`)
        } else {
          // Create new customer
          console.log(`Creating new customer: ${customerData.name}, email: ${customerData.email || 'NULL'}`)
          const { error: insertError } = await supabaseServer
            .from('customers')
            .insert(customerData)
          
          if (insertError) {
            console.error(`Insert error for ${customerData.name}:`, insertError)
            throw new Error(`Insert failed: ${insertError.message}`)
          }
          console.log(`Successfully created customer: ${customerData.name}`)
        }

        successCount++

      } catch (error) {
        errors.push(`Sor ${rowNum}: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        errorCount++
      }
    }

    console.log(`=== IMPORT COMPLETED: ${successCount} success, ${errorCount} errors ===`)
    
    if (errors.length > 0) {
      console.log('Import errors:', errors)
      return NextResponse.json({ 
        error: 'Import completed with errors', 
        details: errors,
        successCount,
        errorCount 
      }, { status: 400 })
    }

    console.log('Import successful!')
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

