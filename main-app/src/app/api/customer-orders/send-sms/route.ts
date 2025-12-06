import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import twilio from 'twilio'

/**
 * Send SMS notifications for customer orders and update sms_sent_at timestamp
 */
export async function POST(request: NextRequest) {
  try {
    const { order_ids } = await request.json()

    // Allow empty order_ids (user deselected all SMS recipients)
    if (!order_ids || !Array.isArray(order_ids)) {
      return NextResponse.json(
        { error: 'Invalid order IDs' },
        { status: 400 }
      )
    }

    // If no orders selected for SMS, skip SMS sending
    const shouldSendSms = order_ids.length > 0

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

    let smsSentCount = 0
    const errors: string[] = []

    // Only send SMS if orders are selected
    if (shouldSendSms) {
      console.log(`[SMS] Sending SMS to ${order_ids.length} customer orders`)

      // Fetch Beszerzés SMS template
      const { data: smsTemplate, error: templateError } = await supabase
        .from('sms_settings')
        .select('message_template')
        .eq('template_name', 'Beszerzés')
        .single()

      if (templateError || !smsTemplate) {
        console.error('Error fetching SMS template:', templateError)
        return NextResponse.json(
          { error: 'SMS template not found' },
          { status: 500 }
        )
      }

      // Fetch company name
      const { data: companyData, error: companyError } = await supabase
        .from('tenant_company')
        .select('name')
        .single()

      const companyName = companyData?.name || 'Turinova'

      // Initialize Twilio client
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

      // Send SMS for each selected order
      for (const orderId of order_ids) {
        try {
          // Fetch order details
          const { data: orderData, error: orderError } = await supabase
            .from('customer_orders')
            .select('customer_name, customer_mobile, total_gross, created_at')
            .eq('id', orderId)
            .single()

          if (orderError || !orderData) {
            console.error(`Error fetching order ${orderId}:`, orderError)
            errors.push(`Failed to fetch order ${orderId}`)
            continue
          }

          // Format price
          const totalPriceFormatted = new Intl.NumberFormat('hu-HU').format(Math.round(orderData.total_gross)) + ' Ft'

          // Format date as YYYY-MM-DD
          const createdDate = new Date(orderData.created_at).toISOString().split('T')[0]

          // Replace variables in template
          const message = smsTemplate.message_template
            .replace(/{customer_name}/g, orderData.customer_name)
            .replace(/{order_date}/g, createdDate)
            .replace(/{total_price}/g, totalPriceFormatted)
            .replace(/{company_name}/g, companyName)

          // Send SMS via Twilio
          await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: orderData.customer_mobile
          })

          smsSentCount++
          console.log(`SMS sent successfully to ${orderData.customer_name} (${orderData.customer_mobile})`)

          // Update customer_orders.sms_sent_at timestamp (if column exists)
          const { error: updateSmsTimestampError } = await supabase
            .from('customer_orders')
            .update({ 
              sms_sent_at: new Date().toISOString()
            })
            .eq('id', orderId)

          if (updateSmsTimestampError) {
            // If column doesn't exist, that's okay - migration hasn't been run yet
            if (updateSmsTimestampError.message?.includes('sms_sent_at') || updateSmsTimestampError.message?.includes('column')) {
              console.log(`[SMS] Column sms_sent_at doesn't exist yet, skipping timestamp update for order ${orderId}`)
            } else {
              console.error(`Error updating sms_sent_at for order ${orderId}:`, updateSmsTimestampError)
            }
            // Don't fail the whole operation, just log the error
          }

        } catch (error) {
          console.error(`Error sending SMS for order ${orderId}:`, error)
          errors.push(`Failed to send SMS for order ${orderId}`)
        }
      }
    } else {
      console.log('[SMS] No orders selected for SMS, skipping SMS sending')
    }

    return NextResponse.json({
      success: true,
      sms_sent_count: smsSentCount,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Error in send-sms endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

