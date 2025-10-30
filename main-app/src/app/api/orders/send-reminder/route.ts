import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

/**
 * POST /api/orders/send-reminder
 * Send storage reminder SMS to customers with orders that have been ready for a while
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { order_ids } = body

    // Validation
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'Legalább egy megrendelés ID szükséges' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, ...options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch orders with customer data and calculate storage days
    console.log(`[Storage Reminder] Fetching ${order_ids.length} orders:`, order_ids)
    
    const { data: orders, error: ordersError } = await supabase
      .from('quotes')
      .select(`
        id,
        quote_number,
        order_number,
        status,
        production_date,
        ready_at,
        updated_at,
        customer_id,
        customers!inner (
          id,
          name,
          mobile
        )
      `)
      .in('id', order_ids)
      .eq('status', 'ready')  // Only ready (Kész) orders

    if (ordersError) {
      console.error('[Storage Reminder] Error fetching orders:', ordersError)
      return NextResponse.json(
        { error: 'Hiba történt a megrendelések lekérdezése során', details: ordersError.message },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      console.log('[Storage Reminder] No ready orders found')
      return NextResponse.json({
        success: true,
        sms_sent: 0,
        message: 'Nincs "Kész" státuszú megrendelés a kiválasztottak között'
      })
    }

    // Filter orders that have mobile number (no sms_notification check)
    const ordersForSMS = orders.filter(order => order.customers?.mobile)
    console.log(`[Storage Reminder] Found ${ordersForSMS.length} orders with mobile numbers`)

    // Calculate storage days for each order (matches UI calculation)
    const ordersWithDays = ordersForSMS.map(order => {
      // Use ready_at if available (most accurate), otherwise fall back to production_date or updated_at
      const referenceDate = order.ready_at || order.production_date || order.updated_at
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Start of today
      const readyDate = new Date(referenceDate)
      readyDate.setHours(0, 0, 0, 0) // Start of ready day
      
      // Calculate full days difference (0 = same day, 1 = next day)
      const diffTime = today.getTime() - readyDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      return {
        ...order,
        storage_days: diffDays
      }
    })

    // Fetch company name
    let companyName = 'Turinova'
    try {
      const { data: companyData } = await supabase
        .from('tenant_company')
        .select('name')
        .limit(1)
        .single()
      
      if (companyData?.name) {
        companyName = companyData.name
        console.log(`[Storage Reminder] Using company name: ${companyName}`)
      }
    } catch (error) {
      console.error('[Storage Reminder] Error fetching company name, using default:', error)
    }

    // Send SMS notifications
    const smsResults = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    console.log(`[Storage Reminder] Sending ${ordersWithDays.length} reminder SMS...`)

    for (const order of ordersWithDays) {
      const result = await sendStorageReminderSMS(
        order.customers.name,
        order.customers.mobile,
        order.order_number || order.quote_number,
        companyName,
        order.storage_days,
        order.id
      )

      if (result.success) {
        smsResults.sent++
        console.log(`[Storage Reminder] ✓ Sent to ${order.customers.name} (${order.customers.mobile}) - ${order.storage_days} days`)
        
        // Update last_storage_reminder_sent_at timestamp
        const { error: timestampError } = await supabase
          .from('quotes')
          .update({ last_storage_reminder_sent_at: new Date().toISOString() })
          .eq('id', order.id)
        
        if (timestampError) {
          console.error(`[Storage Reminder] Error updating last_storage_reminder_sent_at for order ${order.id}:`, timestampError)
          // Don't fail the operation, just log the error
        }
      } else {
        smsResults.failed++
        smsResults.errors.push(`${order.customers.name}: ${result.error}`)
        console.error(`[Storage Reminder] ✗ Failed for ${order.customers.name}:`, result.error)
      }
    }

    console.log(`[Storage Reminder] Results: ${smsResults.sent} sent, ${smsResults.failed} failed`)

    return NextResponse.json({
      success: true,
      sms_sent: smsResults.sent,
      sms_failed: smsResults.failed,
      errors: smsResults.errors
    })

  } catch (error) {
    console.error('[Storage Reminder] Error:', error)
    return NextResponse.json(
      { error: 'Hiba történt az SMS küldése során' },
      { status: 500 }
    )
  }
}

/**
 * Send storage reminder SMS using Tárolás figyelmeztetés template
 */
async function sendStorageReminderSMS(
  customerName: string,
  customerMobile: string,
  orderNumber: string,
  companyName: string,
  storageDays: number,
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Twilio credentials from environment (use same env vars as working SMS)
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER  // Changed from TWILIO_FROM_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[Storage Reminder SMS] Missing Twilio credentials')
      console.error('[Storage Reminder SMS] accountSid:', !!accountSid, 'authToken:', !!authToken, 'fromNumber:', !!fromNumber)
      return { success: false, error: 'Twilio credentials not configured' }
    }

    // Validate and normalize Hungarian mobile number
    let normalizedMobile = customerMobile.trim()
    if (normalizedMobile.startsWith('06')) {
      normalizedMobile = '+36' + normalizedMobile.substring(2)
    } else if (normalizedMobile.startsWith('36')) {
      normalizedMobile = '+' + normalizedMobile
    } else if (!normalizedMobile.startsWith('+')) {
      normalizedMobile = '+36' + normalizedMobile
    }

    // Remove any spaces, dashes, or parentheses
    normalizedMobile = normalizedMobile.replace(/[\s\-()]/g, '')

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Fetch "Tárolás figyelmeztetés" template from database
    let messageTemplate = 'Kedves {customer_name}! Az On {order_number} szamu rendelese mar {days} napja kesz es athvehetο. Kerem, vegye fel velunk a kapcsolatot! Udvozlettel, {company_name}'
    
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const { data: settings } = await supabase
        .from('sms_settings')
        .select('message_template')
        .eq('template_name', 'Tárolás figyelmeztetés')
        .single()
      
      if (settings?.message_template) {
        messageTemplate = settings.message_template
        console.log('[Storage Reminder SMS] Using "Tárolás figyelmeztetés" template from database')
      } else {
        console.log('[Storage Reminder SMS] Using default template (no "Tárolás figyelmeztetés" template found)')
      }
    } catch (error) {
      console.error('[Storage Reminder SMS] Error fetching template, using default:', error)
    }

    // Replace placeholders in template
    const message = messageTemplate
      .replace(/{customer_name}/g, customerName)
      .replace(/{order_number}/g, orderNumber)
      .replace(/{company_name}/g, companyName)
      .replace(/{days}/g, storageDays.toString())

    console.log(`[Storage Reminder SMS] Sending to ${normalizedMobile}: ${message}`)

    // Send SMS
    const twilioMessage = await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedMobile
    })

    console.log(`[Storage Reminder SMS] Message sent, SID: ${twilioMessage.sid}`)
    return { success: true }

  } catch (error: any) {
    console.error('[Storage Reminder SMS] Error sending SMS:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

