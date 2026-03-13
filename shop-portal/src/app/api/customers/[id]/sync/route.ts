import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  syncCustomerGroupToShopRenter
} from '@/lib/shoprenter-api'

/**
 * POST /api/customers/[id]/sync
 * Sync customer TO ShopRenter (push local changes)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get customer with related data
    const { data: customer, error: customerError } = await supabase
      .from('customer_entities')
      .select(`
        *,
        customer_groups:customer_group_id(id, name, code, shoprenter_customer_group_id),
        customer_entity_platform_mappings(
          id,
          connection_id,
          platform_customer_id,
          webshop_connections:connection_id(id, api_url, username, password, connection_type, is_active)
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Vevő nem található' }, { status: 404 })
    }

    // Get addresses
    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_entity_id', id)
      .is('deleted_at', null)

    // Get platform mappings to find active connection
    const platformMappings = customer.customer_entity_platform_mappings || []
    const activeMapping = platformMappings.find((m: any) => 
      m.webshop_connections && 
      m.webshop_connections.connection_type === 'shoprenter' &&
      m.webshop_connections.is_active
    )

    if (!activeMapping || !activeMapping.webshop_connections) {
      return NextResponse.json({ 
        error: 'Nincs aktív ShopRenter kapcsolat ehhez a vevőhöz',
        details: 'Kérjük, először szinkronizálja a vevőt a kapcsolatok oldalon.'
      }, { status: 400 })
    }

    const connection = activeMapping.webshop_connections

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ 
        error: 'Érvénytelen API URL formátum' 
      }, { status: 400 })
    }

    // Get authentication
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get or sync customer group
    let customerGroupShopRenterId: string | null = null
    if (customer.customer_group_id && customer.customer_groups) {
      const customerGroup = customer.customer_groups as any
      customerGroupShopRenterId = customerGroup.shoprenter_customer_group_id || null

      // If customer group not synced, sync it first
      if (!customerGroupShopRenterId) {
        console.log(`[SYNC] Customer group "${customerGroup.name}" not synced, syncing now...`)
        const syncResult = await syncCustomerGroupToShopRenter(
          apiBaseUrl,
          authHeader,
          {
            id: customerGroup.id,
            name: customerGroup.name,
            code: customerGroup.code,
            shoprenter_customer_group_id: null
          }
        )

        if (syncResult.shoprenterId) {
          customerGroupShopRenterId = syncResult.shoprenterId
          // Update customer group with ShopRenter ID
          await supabase
            .from('customer_groups')
            .update({ shoprenter_customer_group_id: customerGroupShopRenterId })
            .eq('id', customerGroup.id)
          console.log(`[SYNC] ✅ Synced customer group "${customerGroup.name}" to ShopRenter: ${customerGroupShopRenterId}`)
        } else {
          console.warn(`[SYNC] ⚠️ Failed to sync customer group "${customerGroup.name}": ${syncResult.error}`)
        }
      }
    }

    // Build customer payload for ShopRenter
    const customerPayload: any = {
      firstname: customer.entity_type === 'person' ? (customer.firstname || '') : '',
      lastname: customer.entity_type === 'person' ? (customer.lastname || '') : '',
      email: customer.email || '',
      telephone: customer.telephone || '',
      status: customer.is_active ? '1' : '0',
      approved: customer.is_active ? '1' : '0',
      newsletter: '0',
      freeShipping: '0'
    }

    // Add customer group if exists
    if (customerGroupShopRenterId) {
      customerPayload.customerGroup = {
        id: customerGroupShopRenterId
      }
    }

    // Determine if customer exists in ShopRenter
    const existingShopRenterId = activeMapping.platform_customer_id
    let method: string
    let customerUrl: string

    if (existingShopRenterId) {
      // Update existing customer
      method = 'PUT'
      customerUrl = `${apiBaseUrl}/customers/${existingShopRenterId}`
    } else {
      // Create new customer
      method = 'POST'
      customerUrl = `${apiBaseUrl}/customers`
    }

    console.log(`[SYNC] ${method} ${customerUrl}`)
    console.log(`[SYNC] Customer payload:`, JSON.stringify(customerPayload, null, 2))

    // Push customer to ShopRenter
    const customerResponse = await fetch(customerUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(customerPayload),
      signal: AbortSignal.timeout(30000)
    })

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text().catch(() => 'Unknown error')
      console.error(`[SYNC] Customer push failed: ${customerResponse.status} - ${errorText}`)
      
      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter API hiba (${customerResponse.status}): ${errorText.substring(0, 200)}` 
      }, { status: customerResponse.status })
    }

    const customerResult = await customerResponse.json().catch(() => null)
    const finalShopRenterCustomerId = customerResult?.id || existingShopRenterId

    if (!finalShopRenterCustomerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nem sikerült meghatározni a ShopRenter vevő ID-t' 
      }, { status: 500 })
    }

    // Update or create platform mapping
    if (existingShopRenterId) {
      await supabase
        .from('customer_entity_platform_mappings')
        .update({
          last_synced_to_platform_at: new Date().toISOString()
        })
        .eq('id', activeMapping.id)
    } else {
      // Create new mapping
      await supabase
        .from('customer_entity_platform_mappings')
        .insert({
          customer_entity_id: id,
          connection_id: connection.id,
          platform_customer_id: finalShopRenterCustomerId,
          platform_inner_id: customerResult?.innerId || null,
          platform_username: customer.email || null,
          last_synced_to_platform_at: new Date().toISOString()
        })
    }

    // Sync addresses
    if (addresses && addresses.length > 0) {
      // Get existing addresses from ShopRenter
      const addressesUrl = `${apiBaseUrl}/addresses?customerId=${finalShopRenterCustomerId}`
      const addressesResponse = await fetch(addressesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(30000)
      })

      const existingShopRenterAddresses: any[] = []
      if (addressesResponse.ok) {
        const addressesData = await addressesResponse.json().catch(() => null)
        existingShopRenterAddresses.push(...(addressesData?.items || addressesData?.response?.items || []))
      }

      // Sync each address
      for (const address of addresses) {
        // Find existing ShopRenter address mapping
        const { data: addressMapping } = await supabase
          .from('customer_address_platform_mappings')
          .select('platform_address_id')
          .eq('address_id', address.id)
          .eq('connection_id', connection.id)
          .single()

        const existingShopRenterAddressId = addressMapping?.platform_address_id

        // Build address payload
        const addressPayload: any = {
          company: address.company || '',
          firstname: address.firstname || '',
          lastname: address.lastname || '',
          address1: address.address1 || '',
          address2: address.address2 || '',
          postcode: address.postcode || '',
          city: address.city || '',
          telephone: address.telephone || '',
          customer: {
            id: finalShopRenterCustomerId
          },
          country: {
            id: 'Y291bnRyeS1jb3VudHJ5X2lkPTk3' // Hungary default - can be improved
          },
          type: address.address_type === 'billing' || address.company ? 'business' : 'private'
        }

        let addressMethod: string
        let addressUrl: string

        if (existingShopRenterAddressId) {
          // Update existing address
          addressMethod = 'PUT'
          addressUrl = `${apiBaseUrl}/addresses/${existingShopRenterAddressId}`
        } else {
          // Create new address
          addressMethod = 'POST'
          addressUrl = `${apiBaseUrl}/addresses`
        }

        try {
          const addressResponse = await fetch(addressUrl, {
            method: addressMethod,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(addressPayload),
            signal: AbortSignal.timeout(30000)
          })

          if (addressResponse.ok) {
            const addressResult = await addressResponse.json().catch(() => null)
            const finalAddressId = addressResult?.id || existingShopRenterAddressId

            if (finalAddressId) {
              // Update or create address mapping
              if (existingShopRenterAddressId) {
                // Mapping already exists, just update timestamp
              } else {
                // Create new mapping
                await supabase
                  .from('customer_address_platform_mappings')
                  .insert({
                    address_id: address.id,
                    connection_id: connection.id,
                    platform_address_id: finalAddressId
                  })
              }

              // Set as default address if needed
              if (address.is_default_billing && customerResult) {
                await fetch(`${apiBaseUrl}/customers/${finalShopRenterCustomerId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify({
                    defaultAddress: {
                      id: finalAddressId
                    }
                  }),
                  signal: AbortSignal.timeout(30000)
                })
              }
            }
          } else {
            console.warn(`[SYNC] Failed to sync address: ${addressResponse.status}`)
          }
        } catch (addressError) {
          console.error(`[SYNC] Error syncing address:`, addressError)
        }
      }
    }

    // Update customer sync timestamp
    await supabase
      .from('customer_entity_platform_mappings')
      .update({
        last_synced_to_platform_at: new Date().toISOString()
      })
      .eq('customer_entity_id', id)
      .eq('connection_id', connection.id)

    return NextResponse.json({
      success: true,
      message: 'Vevő sikeresen szinkronizálva ShopRenter-be',
      shoprenter_customer_id: finalShopRenterCustomerId
    })

  } catch (error) {
    console.error('Error syncing customer:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ismeretlen hiba a szinkronizálás során'
    }, { status: 500 })
  }
}
