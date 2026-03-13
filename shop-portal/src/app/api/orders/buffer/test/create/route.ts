import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * POST /api/orders/buffer/test/create
 * Create a test ShopRenter order in buffer for preview/testing
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get first active ShopRenter connection
    const { data: connections, error: connError } = await supabase
      .from('webshop_connections')
      .select('id, name, api_url')
      .eq('connection_type', 'shoprenter')
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'No active ShopRenter connection found. Please create a connection first.' },
        { status: 400 }
      )
    }

    const connection = connections[0]

    // Create test webhook payload based on ShopRenter documentation
    const testWebhookPayload = {
      orders: {
        order: [
          {
            storeName: extractShopNameFromUrl(connection.api_url) || 'test',
            innerId: `test-${Date.now()}`,
            innerResourceId: `orders/test-${Date.now()}`,
            outerResourceId: '',
            firstname: 'Teszt',
            lastname: 'Vásárló',
            phone: '+36123456789',
            fax: '',
            email: 'teszt@example.com',
            cart_token: 'test-cart-token',
            shippingFirstname: 'Teszt',
            shippingLastname: 'Vásárló',
            shippingCompany: '',
            shippingAddress1: 'Teszt utca 1',
            shippingAddress2: '',
            shippingCity: 'Budapest',
            shippingCountryName: 'Hungary',
            shippingZoneName: 'Budapest',
            shippingPostcode: '1011',
            paymentFirstname: 'Teszt',
            paymentLastname: 'Vásárló',
            paymentCompany: '',
            paymentAddress1: 'Teszt utca 1',
            paymentAddress2: '',
            paymentCity: 'Budapest',
            paymentCountryName: 'Hungary',
            paymentZoneName: 'Budapest',
            paymentPostcode: '1011',
            paymentTaxnumber: '',
            shippingMethodName: 'GLS csomagpont',
            shippingMethodExtension: 'GLSPARCELPOINT',
            shippingNetPrice: 970.07,
            shippingGrossPrice: 1006,
            shippingInnerResourceId: 'shippingModeExtend/test',
            paymentMethodName: 'Utánvét',
            paymentMethodCode: 'COD',
            paymentNetPrice: 0,
            paymentGrossPrice: 0,
            couponCode: '',
            couponGrossPrice: null,
            languageId: '1',
            languageCode: 'hu',
            comment: 'Teszt rendelés az előnézethez',
            total: '9945',
            totalGross: '11206',
            taxPrice: '255',
            currency: 'HUF',
            orderHistory: {
              status: '1',
              statusText: 'Pending',
              comment: '',
              dateAdded: new Date().toISOString().replace('T', ' ').substring(0, 19)
            },
            orderProducts: {
              orderProduct: [
                {
                  innerId: '608',
                  innerResourceId: 'orderProducts/test-608',
                  outerResourceId: '',
                  name: 'Teszt termék',
                  sku: 'TEST-001',
                  price: '945',
                  currency: 'HUF',
                  taxRate: '27.0000',
                  quantity: '1',
                  image: 'https://via.placeholder.com/300',
                  category: 'Teszt kategória',
                  volume: {
                    height: '10.00',
                    width: '20.00',
                    length: '30.00',
                    volumeUnit: [
                      {
                        unit: 'cm',
                        language: 'hu'
                      }
                    ]
                  },
                  weight: {
                    weight: '0.50',
                    weightUnit: [
                      {
                        unit: 'kg',
                        language: 'hu'
                      }
                    ]
                  }
                }
              ]
            },
            dateCreated: new Date().toISOString().replace('T', ' ').substring(0, 19)
          }
        ]
      }
    }

    const orderData = testWebhookPayload.orders.order[0]

    // Insert test order into buffer
    const { data: newBuffer, error: insertError } = await supabase
      .from('order_buffer')
      .insert({
        connection_id: connection.id,
        platform_order_id: orderData.innerId,
        platform_order_resource_id: orderData.innerResourceId,
        webhook_data: testWebhookPayload,
        status: 'pending',
        received_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('[TEST BUFFER] Error creating test buffer entry:', insertError)
      return NextResponse.json(
        { error: 'Failed to create test buffer entry', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test order created in buffer',
      buffer_id: newBuffer.id,
      order_id: orderData.innerId,
      connection_name: connection.name
    })

  } catch (error) {
    console.error('[TEST BUFFER] Unexpected error:', error)
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
 * Extract shop name from ShopRenter API URL
 */
function extractShopNameFromUrl(apiUrl: string): string | null {
  try {
    const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
    return match && match[1] ? match[1] : null
  } catch {
    return null
  }
}
