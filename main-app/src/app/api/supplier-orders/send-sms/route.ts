import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import twilio from 'twilio'
import { processBevételezés } from '@/lib/inventory'

/**
 * Send Beszerzés SMS notifications and update items to 'arrived' status
 */
export async function POST(request: NextRequest) {
  try {
    const { order_ids, item_ids } = await request.json()

    // Allow empty order_ids (user deselected all SMS recipients)
    if (!order_ids || !Array.isArray(order_ids)) {
      return NextResponse.json(
        { error: 'Invalid order IDs' },
        { status: 400 }
      )
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'No item IDs provided' },
        { status: 400 }
      )
    }

    // If no orders selected for SMS, skip SMS sending but still update items
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
      console.log(`[SMS] Sending Beszerzés SMS to ${order_ids.length} orders`)

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
          .from('shop_orders')
          .select('customer_name, customer_mobile, customer_discount, created_at')
          .eq('id', orderId)
          .single()

        if (orderError || !orderData) {
          console.error(`Error fetching order ${orderId}:`, orderError)
          errors.push(`Failed to fetch order ${orderId}`)
          continue
        }

        // Fetch all non-deleted items for this order to calculate total price
        const { data: orderItems, error: itemsError } = await supabase
          .from('shop_order_items')
          .select('base_price, multiplier, quantity, status, vat:vat_id(kulcs)')
          .eq('order_id', orderId)
          .is('deleted_at', null)

        if (itemsError || !orderItems) {
          console.error(`Error fetching items for order ${orderId}:`, itemsError)
          errors.push(`Failed to fetch items for order ${orderId}`)
          continue
        }

        // Calculate total price (excluding deleted items)
        let totalPrice = 0
        for (const item of orderItems) {
          if (item.status === 'deleted') continue

          const netPrice = item.base_price * item.multiplier
          const vatRate = item.vat?.kulcs || 0
          const grossPrice = netPrice * (1 + vatRate / 100)
          const itemTotal = grossPrice * item.quantity
          const discountAmount = itemTotal * (orderData.customer_discount / 100)
          const itemFinal = itemTotal - discountAmount

          totalPrice += itemFinal
        }

        // Round to integer
        totalPrice = Math.round(totalPrice)

        // Format price
        const totalPriceFormatted = new Intl.NumberFormat('hu-HU').format(totalPrice) + ' Ft'

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

        // Update shop_orders.sms_sent_at timestamp
        const { error: updateSmsTimestampError } = await supabase
          .from('shop_orders')
          .update({ 
            sms_sent_at: new Date().toISOString()
          })
          .eq('id', orderId)

        if (updateSmsTimestampError) {
          console.error(`Error updating sms_sent_at for order ${orderId}:`, updateSmsTimestampError)
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

    // Update ALL selected items to 'arrived' status (regardless of SMS sent or not)
    const { error: updateError } = await supabase
      .from('shop_order_items')
      .update({ 
        status: 'arrived',
        updated_at: new Date().toISOString()
      })
      .in('id', item_ids)

    if (updateError) {
      console.error('Error updating items:', updateError)
      return NextResponse.json(
        { error: 'Failed to update items after sending SMS' },
        { status: 500 }
      )
    }

    // Phase 1: Process inventory for arrived items (bevételezés)
    let inventoryResult = null
    if (item_ids && item_ids.length > 0) {
      const inventoryStartTime = performance.now()
      console.log(`[Inventory] Triggering bevételezés for ${item_ids.length} items (via SMS flow)`)
      
      try {
        inventoryResult = await processBevételezés(item_ids)
        const inventoryDuration = performance.now() - inventoryStartTime
        
        console.log(`[PERF] Inventory Processing: ${inventoryDuration.toFixed(2)}ms`)
        console.log(`[Inventory] Results: ${inventoryResult.processed} processed, ${inventoryResult.skipped} skipped, ${inventoryResult.errors.length} errors`)
        
        // Log errors but don't fail the API
        if (inventoryResult.errors.length > 0) {
          console.warn('[Inventory] Errors during processing:', inventoryResult.errors)
        }
      } catch (error) {
        console.error('[Inventory] Exception during processing:', error)
        // Don't fail the SMS/status update if inventory fails
      }
    }

    return NextResponse.json({
      success: true,
      sms_sent_count: smsSentCount,
      items_updated_count: item_ids.length,
      errors: errors.length > 0 ? errors : undefined,
      inventory: inventoryResult ? {
        processed: inventoryResult.processed,
        skipped: inventoryResult.skipped,
        errors: inventoryResult.errors
      } : null
    })

  } catch (error) {
    console.error('Error in send-sms endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

