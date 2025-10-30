import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Check which shop_orders are eligible for Beszerzés SMS
 * Eligibility criteria:
 * 1. Shop order would become 'finished' after updating selected items to 'arrived'
 * 2. Customer has valid mobile number
 */
export async function POST(request: NextRequest) {
  try {
    const { item_ids } = await request.json()

    console.log('[SMS Eligibility] Checking eligibility for item IDs:', item_ids)

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      console.log('[SMS Eligibility] No item IDs provided')
      return NextResponse.json(
        { error: 'No item IDs provided' },
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

    // Fetch selected items with their order information
    const { data: selectedItems, error: itemsError } = await supabase
      .from('shop_order_items')
      .select(`
        id,
        order_id,
        status,
        base_price,
        multiplier,
        quantity,
        vat:vat_id(kulcs),
        shop_orders!inner(
          id,
          order_number,
          customer_name,
          customer_mobile,
          customer_discount,
          created_at
        )
      `)
      .in('id', item_ids)
      .is('deleted_at', null)

    if (itemsError) {
      console.error('[SMS Eligibility] Error fetching selected items:', itemsError)
      // Return empty array instead of error - gracefully handle missing data
      return NextResponse.json({
        sms_eligible_orders: []
      })
    }

    if (!selectedItems || selectedItems.length === 0) {
      console.log('[SMS Eligibility] No items found for provided IDs')
      // No items found, return empty array
      return NextResponse.json({
        sms_eligible_orders: []
      })
    }

    console.log('[SMS Eligibility] Found', selectedItems.length, 'items')

    // Group items by order_id
    const orderGroups = new Map<string, any[]>()
    selectedItems?.forEach(item => {
      const orderId = item.order_id
      if (!orderGroups.has(orderId)) {
        orderGroups.set(orderId, [])
      }
      orderGroups.get(orderId)!.push(item)
    })

    const eligibleOrders: any[] = []

    console.log('[SMS Eligibility] Processing', orderGroups.size, 'unique orders')

    // For each unique shop_order, check if it would become 'finished'
    for (const [orderId, itemsInOrder] of orderGroups.entries()) {
      const orderInfo = itemsInOrder[0].shop_orders

      console.log('[SMS Eligibility] Checking order:', orderId, 'Customer:', orderInfo.customer_name)

      // Skip if no mobile number
      if (!orderInfo.customer_mobile || orderInfo.customer_mobile.trim() === '') {
        console.log('[SMS Eligibility] - Skipped: No mobile number')
        continue
      }

      console.log('[SMS Eligibility] - Has mobile:', orderInfo.customer_mobile)

      // Check if customer has SMS notification enabled
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('sms_notification')
        .eq('name', orderInfo.customer_name)
        .is('deleted_at', null)
        .single()

      // Skip if customer not found or SMS notification is disabled
      if (customerError || !customerData || customerData.sms_notification !== true) {
        console.log('[SMS Eligibility] - Skipped:', customerError ? 'Customer not found' : 
          customerData?.sms_notification === false ? 'SMS notification disabled' : 'Unknown reason')
        continue
      }

      console.log('[SMS Eligibility] - Customer has SMS enabled')

      // Fetch ALL items for this order (to check if it would become finished)
      const { data: allOrderItems, error: allItemsError } = await supabase
        .from('shop_order_items')
        .select('id, status, base_price, multiplier, quantity, vat:vat_id(kulcs)')
        .eq('order_id', orderId)
        .is('deleted_at', null)

      if (allItemsError || !allOrderItems || allOrderItems.length === 0) {
        console.error('Error fetching all order items:', allItemsError)
        continue
      }

      // Simulate status after update: selected items become 'arrived'
      const selectedItemIds = new Set(item_ids)
      const simulatedStatuses = allOrderItems.map(item => {
        if (selectedItemIds.has(item.id)) {
          return 'arrived'
        }
        return item.status
      })

      // Check if all non-deleted items would be 'arrived' (status = 'finished')
      const nonDeletedCount = simulatedStatuses.filter(s => s !== 'deleted').length
      const arrivedCount = simulatedStatuses.filter(s => s === 'arrived').length

      const wouldBeFinished = nonDeletedCount > 0 && arrivedCount === nonDeletedCount

      console.log('[SMS Eligibility] - Status check: non-deleted:', nonDeletedCount, 'arrived:', arrivedCount, 'would be finished:', wouldBeFinished)

      if (!wouldBeFinished) {
        console.log('[SMS Eligibility] - Skipped: Would NOT become finished')
        continue
      }

      console.log('[SMS Eligibility] - ✅ ELIGIBLE! Adding to list')

      // Calculate total price (excluding deleted items)
      let totalPrice = 0
      for (const item of allOrderItems) {
        if (item.status === 'deleted') continue

        const netPrice = item.base_price * item.multiplier
        const vatRate = item.vat?.kulcs || 0
        const grossPrice = netPrice * (1 + vatRate / 100)
        const itemTotal = grossPrice * item.quantity
        const discountAmount = itemTotal * (orderInfo.customer_discount / 100)
        const itemFinal = itemTotal - discountAmount

        totalPrice += itemFinal
      }

      // Round to integer
      totalPrice = Math.round(totalPrice)

      // Format price
      const totalPriceFormatted = new Intl.NumberFormat('hu-HU').format(totalPrice) + ' Ft'

      // Format date as YYYY-MM-DD
      const createdDate = new Date(orderInfo.created_at).toISOString().split('T')[0]

      eligibleOrders.push({
        order_id: orderId,
        order_number: orderInfo.order_number,
        customer_name: orderInfo.customer_name,
        customer_mobile: orderInfo.customer_mobile,
        total_price: totalPrice,
        total_price_formatted: totalPriceFormatted,
        created_at: createdDate
      })
    }

    console.log('[SMS Eligibility] Final result:', eligibleOrders.length, 'eligible orders')

    return NextResponse.json({
      sms_eligible_orders: eligibleOrders
    })

  } catch (error) {
    console.error('[SMS Eligibility] ERROR:', error)
    // Return empty array instead of error to gracefully handle any issues
    return NextResponse.json({
      sms_eligible_orders: []
    })
  }
}

