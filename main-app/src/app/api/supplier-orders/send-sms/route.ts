import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import twilio from 'twilio'

/**
 * Send Beszerzés SMS notifications and update items to 'arrived' status
 */
export async function POST(request: NextRequest) {
  try {
    const { order_ids, item_ids } = await request.json()

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: 'No order IDs provided' },
        { status: 400 }
      )
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'No item IDs provided' },
        { status: 400 }
      )
    }

    const supabase = createClient()

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

    let smsSentCount = 0
    const errors: string[] = []

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

      } catch (error) {
        console.error(`Error sending SMS for order ${orderId}:`, error)
        errors.push(`Failed to send SMS for order ${orderId}`)
      }
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

    return NextResponse.json({
      success: true,
      sms_sent_count: smsSentCount,
      items_updated_count: item_ids.length,
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

