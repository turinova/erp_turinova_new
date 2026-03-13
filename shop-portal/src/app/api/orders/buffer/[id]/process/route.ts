import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { extractShopNameFromUrl } from '@/lib/shoprenter-api'

/**
 * POST /api/orders/buffer/[id]/process
 * Process a buffer entry into an actual order
 * 
 * This is a complex operation that:
 * 1. Extracts order data from webhook_data
 * 2. Matches customer (by ID or email)
 * 3. Matches payment/shipping methods
 * 4. Creates order and order_items
 * 5. Updates buffer status to 'processed'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bufferId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get buffer entry
    const { data: bufferEntry, error: bufferError } = await supabase
      .from('order_buffer')
      .select('*')
      .eq('id', bufferId)
      .single()

    if (bufferError || !bufferEntry) {
      return NextResponse.json(
        { error: 'Buffer entry not found' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (bufferEntry.status === 'processed') {
      return NextResponse.json(
        { error: 'Buffer entry already processed' },
        { status: 400 }
      )
    }

    // Check if blacklisted
    if (bufferEntry.is_blacklisted) {
      return NextResponse.json(
        { error: 'Cannot process blacklisted order' },
        { status: 400 }
      )
    }

    // Update buffer status to processing
    await supabase
      .from('order_buffer')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', bufferId)

    const webhookData = bufferEntry.webhook_data as any

    try {
      // Step 1: Extract order data from webhook
      const orderData = extractOrderDataFromWebhook(webhookData, bufferEntry.connection_id)

      // Step 2: Match customer
      const customerPersonId = await matchCustomer(
        supabase,
        webhookData,
        bufferEntry.connection_id
      )

      // Step 3: Match payment and shipping methods
      const { paymentMethodId, shippingMethodId } = await matchPaymentAndShippingMethods(
        supabase,
        webhookData
      )

      // Step 4: Generate order number
      const orderNumber = await generateOrderNumber(supabase)

      // Step 5: Create order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          ...orderData,
          order_number: orderNumber,
          customer_person_id: customerPersonId,
          payment_method_id: paymentMethodId,
          shipping_method_id: shippingMethodId,
          status: 'new', // Moved from pending_review to new
          fulfillability_status: 'unknown', // Will be calculated later
          connection_id: bufferEntry.connection_id
        })
        .select()
        .single()

      if (orderError || !newOrder) {
        throw new Error(`Failed to create order: ${orderError?.message || 'Unknown error'}`)
      }

      // Step 6: Create order items (if orderProducts are in webhook_data)
      // Note: ShopRenter webhook might not include full orderProducts, might need to fetch separately
      const orderItems = await createOrderItems(
        supabase,
        newOrder.id,
        webhookData,
        bufferEntry.connection_id
      )

      // Step 7: Create order totals
      await createOrderTotals(supabase, newOrder.id, webhookData)

      // Step 8: Create order status history
      await supabase
        .from('order_status_history')
        .insert({
          order_id: newOrder.id,
          status: 'new',
          platform_status_id: webhookData?.orderStatus?.id || null,
          platform_status_text: webhookData?.orderStatus?.name || null,
          changed_by: user.id,
          changed_at: new Date().toISOString(),
          source: 'manual'
        })

      // Step 9: Create order platform mapping
      await supabase
        .from('order_platform_mappings')
        .insert({
          order_id: newOrder.id,
          connection_id: bufferEntry.connection_id,
          platform_order_id: bufferEntry.platform_order_id,
          platform_order_resource_id: bufferEntry.platform_order_resource_id,
          last_synced_from_platform_at: new Date().toISOString()
        })

      // Step 10: Update buffer status to processed
      await supabase
        .from('order_buffer')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', bufferId)

      return NextResponse.json({
        success: true,
        message: 'Order created successfully',
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        items_count: orderItems.length
      })

    } catch (error) {
      // Update buffer with error
      await supabase
        .from('order_buffer')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString()
        })
        .eq('id', bufferId)

      console.error('[BUFFER PROCESS] Error processing buffer entry:', error)
      return NextResponse.json(
        { 
          error: 'Failed to process buffer entry',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[BUFFER PROCESS] Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * Extract order data from webhook payload
 */
function extractOrderDataFromWebhook(webhookData: any, connectionId: string) {
  // Handle different webhook formats
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData

  return {
    platform_order_id: orderData.innerId || orderData.id,
    platform_order_resource_id: orderData.innerResourceId || orderData.id || orderData.href,
    invoice_number: orderData.invoiceId || null,
    invoice_prefix: orderData.invoicePrefix || null,
    
    // Customer info (snapshot)
    customer_firstname: orderData.firstname || '',
    customer_lastname: orderData.lastname || '',
    customer_email: orderData.email || null,
    customer_phone: orderData.phone || null,
    
    // Shipping address
    shipping_firstname: orderData.shippingFirstname || orderData.firstname || '',
    shipping_lastname: orderData.shippingLastname || orderData.lastname || '',
    shipping_company: orderData.shippingCompany || null,
    shipping_address1: orderData.shippingAddress1 || '',
    shipping_address2: orderData.shippingAddress2 || null,
    shipping_city: orderData.shippingCity || '',
    shipping_postcode: orderData.shippingPostcode || '',
    shipping_country_code: orderData.shippingCountryName || null,
    shipping_zone_name: orderData.shippingZoneName || null,
    shipping_method_name: orderData.shippingMethodName || null,
    shipping_method_code: orderData.shippingMethodExtension || null,
    shipping_method_extension: orderData.shippingMethodExtension || null,
    shipping_receiving_point_id: orderData.shippingReceivingPointId || orderData.pickPackPontShopCode || null,
    shipping_net_price: parseFloat(orderData.shippingNetPrice || '0') || 0,
    shipping_gross_price: parseFloat(orderData.shippingGrossPrice || '0') || 0,
    
    // Billing address
    billing_firstname: orderData.paymentFirstname || orderData.firstname || '',
    billing_lastname: orderData.paymentLastname || orderData.lastname || '',
    billing_company: orderData.paymentCompany || null,
    billing_address1: orderData.paymentAddress1 || '',
    billing_address2: orderData.paymentAddress2 || null,
    billing_city: orderData.paymentCity || '',
    billing_postcode: orderData.paymentPostcode || '',
    billing_country_code: orderData.paymentCountryName || null,
    billing_zone_name: orderData.paymentZoneName || null,
    billing_tax_number: orderData.paymentTaxnumber || orderData.taxNumber || null,
    
    // Payment info
    payment_method_name: orderData.paymentMethodName || null,
    payment_method_code: orderData.paymentMethodCode || null,
    payment_method_after: orderData.paymentMethodAfter === '1' || orderData.paymentMethodAfter === true,
    payment_status: 'pending',
    
    // Order totals (will be calculated from orderTotals if available)
    subtotal_net: parseFloat(orderData.total || '0') || 0,
    subtotal_gross: parseFloat(orderData.totalGross || orderData.total || '0') || 0,
    tax_amount: parseFloat(orderData.taxPrice || '0') || 0,
    discount_amount: parseFloat(orderData.couponGrossPrice || '0') || 0,
    shipping_total_net: parseFloat(orderData.shippingNetPrice || '0') || 0,
    shipping_total_gross: parseFloat(orderData.shippingGrossPrice || '0') || 0,
    payment_total_net: 0,
    payment_total_gross: 0,
    total_net: parseFloat(orderData.total || '0') || 0,
    total_gross: parseFloat(orderData.totalGross || orderData.total || '0') || 0,
    currency_code: orderData.currency?.code || orderData.currency || 'HUF',
    
    // Additional info
    customer_comment: orderData.comment || null,
    language_code: orderData.languageCode || orderData.language?.code || 'hu',
    ip_address: orderData.ip || null,
    cart_token: orderData.cartToken || orderData.cart_token || null,
    loyalty_points_earned: parseInt(orderData.loyaltyPointsTaxRate || '0') || 0,
    loyalty_points_used: 0,
    
    // Timestamps
    order_date: orderData.dateCreated ? new Date(orderData.dateCreated).toISOString() : new Date().toISOString()
  }
}

/**
 * Match customer by ShopRenter customer ID or email
 */
async function matchCustomer(
  supabase: any,
  webhookData: any,
  connectionId: string
): Promise<string | null> {
  // Try to get customer ID from webhook
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData
  const customerHref = orderData.customer?.href

  if (!customerHref) {
    // Try to match by email
    if (orderData.email) {
      const { data: person } = await supabase
        .from('customer_persons')
        .select('id')
        .eq('email', orderData.email)
        .is('deleted_at', null)
        .single()

      if (person) {
        return person.id
      }
    }
    return null // Guest order
  }

  // Try to find the platform mapping
  try {
    const { data: mapping } = await supabase
      .from('customer_platform_mappings')
      .select('person_id')
      .eq('connection_id', connectionId)
      .eq('platform_customer_id', customerHref)
      .single()

    if (mapping?.person_id) {
      return mapping.person_id
    }
  } catch (error) {
    console.warn('[BUFFER PROCESS] Could not match customer by platform ID:', error)
  }

  // Fallback: try email
  if (orderData.email) {
    const { data: person } = await supabase
      .from('customer_persons')
      .select('id')
      .eq('email', orderData.email)
      .is('deleted_at', null)
      .single()

    if (person) {
      return person.id
    }
  }

  return null // Guest order
}

/**
 * Match payment and shipping methods
 */
async function matchPaymentAndShippingMethods(
  supabase: any,
  webhookData: any
): Promise<{ paymentMethodId: string | null; shippingMethodId: string | null }> {
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData
  
  let paymentMethodId: string | null = null
  let shippingMethodId: string | null = null

  // Match payment method
  if (orderData.paymentMethodCode) {
    const { data: paymentMethod } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('code', orderData.paymentMethodCode)
      .is('deleted_at', null)
      .eq('active', true)
      .single()

    if (paymentMethod) {
      paymentMethodId = paymentMethod.id
    }
  }

  // Match shipping method
  if (orderData.shippingMethodExtension || orderData.shippingMethodCode) {
    const code = orderData.shippingMethodExtension || orderData.shippingMethodCode
    const { data: shippingMethod } = await supabase
      .from('shipping_methods')
      .select('id')
      .eq('code', code)
      .is('deleted_at', null)
      .eq('is_active', true)
      .single()

    if (shippingMethod) {
      shippingMethodId = shippingMethod.id
    }
  }

  return { paymentMethodId, shippingMethodId }
}

/**
 * Generate unique order number
 */
async function generateOrderNumber(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc('generate_order_number')
  
  if (error || !data) {
    // Fallback: manual generation
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-')
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .like('order_number', `ORD-${today}-%`)
      .is('deleted_at', null)
    
    const sequence = ((count || 0) + 1).toString().padStart(3, '0')
    return `ORD-${today}-${sequence}`
  }

  return data
}

/**
 * Create order items from webhook data
 */
async function createOrderItems(
  supabase: any,
  orderId: string,
  webhookData: any,
  connectionId: string
): Promise<any[]> {
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData
  const orderProducts = orderData.orderProducts || []

  if (!Array.isArray(orderProducts) || orderProducts.length === 0) {
    console.warn('[BUFFER PROCESS] No order products in webhook data')
    return []
  }

  const orderItems = []

  for (const product of orderProducts) {
    // Try to find product by SKU
    let productId: string | null = null
    if (product.sku) {
      const { data: productData } = await supabase
        .from('shoprenter_products')
        .select('id')
        .eq('sku', product.sku)
        .is('deleted_at', null)
        .single()

      if (productData) {
        productId = productData.id
      }
    }

    const unitPriceNet = parseFloat(product.price || product.priceNet || '0') || 0
    const unitPriceGross = parseFloat(product.priceGross || product.price || '0') || 0
    const quantity = parseInt(product.quantity || '1') || 1
    const taxRate = parseFloat(product.taxRate || '0') || 0

    const orderItem = {
      order_id: orderId,
      product_id: productId,
      product_name: product.name || '',
      product_sku: product.sku || '',
      product_model_number: product.modelNumber || product.model || null,
      product_gtin: product.gtin || product.ean || null,
      product_image_url: product.image || null,
      product_category: product.category || null,
      unit_price_net: unitPriceNet,
      unit_price_gross: unitPriceGross,
      tax_rate: taxRate,
      quantity: quantity,
      line_total_net: unitPriceNet * quantity,
      line_total_gross: unitPriceGross * quantity,
      platform_order_item_id: product.innerId || product.id || null,
      platform_order_item_resource_id: product.innerResourceId || product.id || product.href || null,
      fulfillability_status: 'unknown',
      status: 'pending'
    }

    orderItems.push(orderItem)
  }

  if (orderItems.length > 0) {
    const { data, error } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select()

    if (error) {
      console.error('[BUFFER PROCESS] Error creating order items:', error)
      throw new Error(`Failed to create order items: ${error.message}`)
    }

    return data || []
  }

  return []
}

/**
 * Create order totals from webhook data
 */
async function createOrderTotals(
  supabase: any,
  orderId: string,
  webhookData: any
): Promise<void> {
  const orderData = webhookData.orders?.order?.[0] || webhookData.order || webhookData
  const orderTotals = orderData.orderTotals || []

  if (Array.isArray(orderTotals) && orderTotals.length > 0) {
    const totals = orderTotals.map((total: any, index: number) => ({
      order_id: orderId,
      name: total.name || total.title || '',
      value_net: parseFloat(total.valueNet || total.value || '0') || 0,
      value_gross: parseFloat(total.valueGross || total.value || '0') || 0,
      type: mapTotalType(total.type || total.code || ''),
      sort_order: index + 1,
      description: total.description || null
    }))

    const { error } = await supabase
      .from('order_totals')
      .insert(totals)

    if (error) {
      console.error('[BUFFER PROCESS] Error creating order totals:', error)
      // Don't throw - totals are not critical
    }
  }
}

/**
 * Map ShopRenter total type to our type
 */
function mapTotalType(shoprenterType: string): string {
  const typeMap: Record<string, string> = {
    'sub_total': 'SUB_TOTAL',
    'sub_total_with_tax': 'SUB_TOTAL_WITH_TAX',
    'tax': 'TAX',
    'shipping': 'SHIPPING',
    'payment': 'PAYMENT',
    'coupon': 'COUPON',
    'discount': 'DISCOUNT',
    'total': 'TOTAL'
  }

  return typeMap[shoprenterType.toLowerCase()] || 'TOTAL'
}
