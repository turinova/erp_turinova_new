import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'
import { updateProgress, clearProgress, shouldStopSync, getProgress, incrementProgress } from '@/lib/sync-progress-store'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'

/**
 * Extract shop name from ShopRenter API URL
 */
function extractShopNameFromUrlLocal(apiUrl: string): string | null {
  try {
    const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
    return match && match[1] ? match[1] : null
  } catch {
    return null
  }
}

/**
 * POST /api/connections/[id]/sync-customers
 * Sync customers from ShopRenter to database (PULL)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectionId } = await params
  try {
    let forceSync = false
    try {
      const body = await request.json().catch(() => ({}))
      forceSync = body?.force === true
    } catch {
      // Body might be empty, that's OK
    }

    // Get tenant-aware Supabase client
    const supabase = await getTenantSupabase()

    // Get tenant context for tenant-specific rate limiting
    const tenant = await getTenantFromSession()
    const tenantId = tenant?.id

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('[SYNC] Authentication failed:', userError?.message || 'No user found')
      return NextResponse.json({ 
        success: false,
        error: 'Authentication failed. Please log out and log back in, then try again.',
        details: userError?.message || 'Session expired or invalid'
      }, { status: 401 })
    }

    // Check if sync is already running for this connection
    const existingProgress = getProgress(`customers-${connectionId}`)
    if (existingProgress && (existingProgress.status === 'syncing' || existingProgress.status === 'starting')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Szinkronizálás már folyamatban van erre a kapcsolatra.',
        details: `Jelenleg ${existingProgress.synced}/${existingProgress.total} vevő szinkronizálva.`,
        existingProgress: {
          synced: existingProgress.synced,
          total: existingProgress.total,
          status: existingProgress.status
        }
      }, { status: 409 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ 
        success: false,
        error: 'Kapcsolat nem található vagy érvénytelen típus',
        details: 'Csak ShopRenter kapcsolatokhoz szinkronizálható vevők.'
      }, { status: 404 })
    }

    // Validate connection is active
    if (!connection.is_active) {
      return NextResponse.json({ 
        success: false,
        error: 'A kapcsolat inaktív',
        details: 'Kérjük, aktiválja a kapcsolatot a szinkronizálás előtt.'
      }, { status: 400 })
    }

    // Validate connection has required credentials
    if (!connection.username || !connection.password) {
      return NextResponse.json({ 
        success: false,
        error: 'Hiányzó hitelesítési adatok',
        details: 'Kérjük, ellenőrizze, hogy a kapcsolat rendelkezik-e felhasználónévvel és jelszóval.'
      }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrlLocal(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ 
        success: false,
        error: 'Érvénytelen API URL formátum',
        details: 'Az API URL formátuma nem megfelelő.'
      }, { status: 400 })
    }

    // Get authentication
    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get rate limiter
    const rateLimiter = getShopRenterRateLimiter(tenantId)

    // Initialize progress
    updateProgress(`customers-${connectionId}`, {
      status: 'starting',
      synced: 0,
      total: 0,
      current: 'Vevők lekérése...'
    })

    try {
      // First, fetch customer IDs using the customers endpoint (supports pagination)
      // Then fetch full customer data using customerExtend for each customer
      let page = 0
      let allCustomerIds: string[] = []
      let hasMore = true

      // Step 1: Fetch all customer IDs with pagination
      while (hasMore) {
        if (shouldStopSync(`customers-${connectionId}`)) {
          clearProgress(`customers-${connectionId}`)
          return NextResponse.json({ 
            success: false, 
            error: 'Szinkronizálás leállítva' 
          }, { status: 200 })
        }

        // Rate limiting - wrap fetch in execute()
        const customersUrl = `${apiBaseUrl}/customers?page=${page}&limit=200`
        console.log(`[SYNC] Fetching customer IDs page ${page}...`)

        const response = await rateLimiter.execute(async () => {
          return fetch(customersUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(30000)
          })
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error(`[SYNC] Failed to fetch customer IDs page ${page}: ${response.status} - ${errorText}`)
          
          // If it's a 400 error about page not found, it means we've reached the end
          if (response.status === 400) {
            const errorData = await response.json().catch(() => null)
            if (errorData?.error === 40008 || errorData?.message?.includes('Page not found')) {
              console.log(`[SYNC] Reached end of pages at page ${page}`)
              hasMore = false
              break
            }
          }
          
          // For other errors, break the loop
          break
        }

        const data = await response.json().catch(() => null)
        const items = data?.items || data?.response?.items || []

        if (items.length === 0) {
          hasMore = false
        } else {
          // Extract customer IDs
          for (const item of items) {
            const customerId = item.id || item.href?.split('/').pop()
            if (customerId) {
              allCustomerIds.push(customerId)
            }
          }
          
          // Update progress
          updateProgress(`customers-${connectionId}`, {
            status: 'syncing',
            synced: 0,
            total: allCustomerIds.length,
            current: `${allCustomerIds.length} vevő ID betöltve...`
          })

          // Check if there are more pages using the 'next' field from response
          const nextPage = data?.next || data?.response?.next
          hasMore = nextPage !== null && nextPage !== undefined
          
          page++
        }
      }

      console.log(`[SYNC] Found ${allCustomerIds.length} customers to sync`)

      // Step 2: Fetch full customer data using customerExtend for each customer
      let allCustomers: any[] = []
      
      for (let i = 0; i < allCustomerIds.length; i++) {
        const customerId = allCustomerIds[i]
        
        if (shouldStopSync(`customers-${connectionId}`)) {
          break
        }

        // Rate limiting
        const customerData = await rateLimiter.execute(async () => {
          const customerExtendUrl = `${apiBaseUrl}/customerExtend/${customerId}?full=1`
          const response = await fetch(customerExtendUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(30000)
          })

          if (!response.ok) {
            console.warn(`[SYNC] Failed to fetch customer ${customerId}: ${response.status}`)
            return null
          }

          return await response.json().catch(() => null)
        })

        if (customerData) {
          allCustomers.push(customerData)
        }

        // Update progress
        if ((i + 1) % 10 === 0 || i === allCustomerIds.length - 1) {
          updateProgress(`customers-${connectionId}`, {
            status: 'syncing',
            synced: 0,
            total: allCustomerIds.length,
            current: `${i + 1}/${allCustomerIds.length} vevő adatai betöltve...`
          })
        }
      }

      // Update total count
      updateProgress(`customers-${connectionId}`, {
        status: 'syncing',
        synced: 0,
        total: allCustomers.length,
        current: `${allCustomers.length} vevő szinkronizálása...`
      })

      console.log(`[SYNC] Found ${allCustomers.length} customers to sync`)

      let synced = 0
      let created = 0
      let updated = 0
      let errors = 0

      // Process each customer
      for (const shoprenterCustomer of allCustomers) {
        if (shouldStopSync(`customers-${connectionId}`)) {
          break
        }

        try {
          // Rate limiting - wrap operations in execute()

          const shoprenterCustomerId = shoprenterCustomer.id
          if (!shoprenterCustomerId) {
            console.warn('[SYNC] Customer missing ID, skipping')
            continue
          }

          // Check if customer already exists in ERP
          // ShopRenter only handles persons, not companies
          const { data: existingMapping } = await supabase
            .from('customer_platform_mappings')
            .select('person_id')
            .eq('connection_id', connectionId)
            .eq('platform_customer_id', shoprenterCustomerId)
            .single()

          // ShopRenter only handles persons, always treat as person
          const firstname = shoprenterCustomer.firstname?.trim() || ''
          const lastname = shoprenterCustomer.lastname?.trim() || ''
          const name = `${lastname} ${firstname}`.trim() || `${firstname} ${lastname}`.trim()

          if (!firstname && !lastname) {
            console.warn(`[SYNC] Customer ${shoprenterCustomerId} has no firstname or lastname, skipping`)
            continue
          }

          // Get customer group ID if exists
          let customerGroupId: string | null = null
          if (shoprenterCustomer.customerGroup) {
            const groupId = typeof shoprenterCustomer.customerGroup === 'object' 
              ? shoprenterCustomer.customerGroup.id 
              : shoprenterCustomer.customerGroup.href?.split('/').pop()
            
            if (groupId) {
              // Find customer group in ERP by ShopRenter ID
              const { data: customerGroup } = await supabase
                .from('customer_groups')
                .select('id')
                .eq('shoprenter_customer_group_id', groupId)
                .is('deleted_at', null)
                .single()
              
              if (customerGroup) {
                customerGroupId = customerGroup.id
              }
            }
          }

          // Prepare person data (ShopRenter only handles persons)
          const personData: any = {
            firstname: firstname || null,
            lastname: lastname || null,
            email: shoprenterCustomer.email?.trim() || null,
            telephone: shoprenterCustomer.telephone?.trim() || null,
            website: null, // ShopRenter doesn't provide website for customers
            identifier: null, // ShopRenter doesn't provide identifier
            source: 'webshop_sync',
            customer_group_id: customerGroupId,
            is_active: shoprenterCustomer.status === '1' || shoprenterCustomer.status === 1,
            tax_number: null, // ShopRenter doesn't provide tax_number for persons
            notes: null
          }

          let personId: string

          if (existingMapping && existingMapping.person_id) {
            // Update existing person
            const { data: updatedPerson, error: updateError } = await supabase
              .from('customer_persons')
              .update(personData)
              .eq('id', existingMapping.person_id)
              .select('id')
              .single()

            if (updateError || !updatedPerson) {
              console.error(`[SYNC] Error updating person ${name}:`, updateError)
              errors++
              continue
            }

            personId = updatedPerson.id
            updated++
          } else {
            // Create new person
            const { data: newPerson, error: createError } = await supabase
              .from('customer_persons')
              .insert(personData)
              .select('id')
              .single()

            if (createError || !newPerson) {
              console.error(`[SYNC] Error creating person ${name}:`, createError)
              errors++
              continue
            }

            personId = newPerson.id
            created++

            // Create platform mapping
            await supabase
              .from('customer_platform_mappings')
              .insert({
                person_id: personId,
                connection_id: connectionId,
                platform_customer_id: shoprenterCustomerId,
                platform_inner_id: shoprenterCustomer.innerId || null,
                platform_username: shoprenterCustomer.email || null,
                last_synced_from_platform_at: new Date().toISOString()
              })
          }

          // Update platform mapping sync timestamp
          await supabase
            .from('customer_platform_mappings')
            .update({
              last_synced_from_platform_at: new Date().toISOString()
            })
            .eq('person_id', personId)
            .eq('connection_id', connectionId)

          // Sync addresses if customerExtend includes them
          if (shoprenterCustomer.addresses && Array.isArray(shoprenterCustomer.addresses)) {
            for (const shoprenterAddress of shoprenterCustomer.addresses) {
              const addressId = shoprenterAddress.id || shoprenterAddress.href?.split('/').pop()
              if (!addressId) continue

              // Check if address already exists
              const { data: existingAddressMapping } = await supabase
                .from('customer_address_platform_mappings')
                .select('address_id')
                .eq('connection_id', connectionId)
                .eq('platform_address_id', addressId)
                .single()

              // Determine address type
              let addressType = 'billing'
              if (shoprenterAddress.type === 'business') {
                addressType = 'billing'
              } else if (shoprenterAddress.type === 'private') {
                addressType = 'shipping'
              }

              // Check if this is the default address
              const isDefaultBilling = shoprenterCustomer.defaultAddress?.id === addressId
              const isDefaultShipping = false // ShopRenter doesn't have separate default shipping

              const addressData: any = {
                person_id: personId, // ShopRenter only handles persons
                address_type: addressType,
                firstname: shoprenterAddress.firstname?.trim() || null,
                lastname: shoprenterAddress.lastname?.trim() || null,
                company: shoprenterAddress.company?.trim() || null,
                address1: shoprenterAddress.address1?.trim() || '',
                address2: shoprenterAddress.address2?.trim() || null,
                postcode: shoprenterAddress.postcode?.trim() || '',
                city: shoprenterAddress.city?.trim() || '',
                country_code: 'HU', // Default, can be improved by fetching country code
                zone_name: null,
                telephone: shoprenterAddress.telephone?.trim() || null,
                is_default_billing: isDefaultBilling,
                is_default_shipping: isDefaultShipping
              }

              if (existingAddressMapping) {
                // Update existing address
                await supabase
                  .from('customer_addresses')
                  .update(addressData)
                  .eq('id', existingAddressMapping.address_id)
              } else {
                // Create new address
                const { data: newAddress, error: addressError } = await supabase
                  .from('customer_addresses')
                  .insert(addressData)
                  .select('id')
                  .single()

                if (!addressError && newAddress) {
                  // Create address platform mapping
                  await supabase
                    .from('customer_address_platform_mappings')
                    .insert({
                      address_id: newAddress.id,
                      connection_id: connectionId,
                      platform_address_id: addressId
                    })
                }
              }
            }
          }

          synced++
          
          // Update progress
          incrementProgress(`customers-${connectionId}`)
          updateProgress(`customers-${connectionId}`, {
            current: `${name} szinkronizálva...`
          })

        } catch (error) {
          console.error('[SYNC] Error processing customer:', error)
          errors++
        }
      }

      // Clear progress
      clearProgress(`customers-${connectionId}`)

      return NextResponse.json({
        success: true,
        synced,
        created,
        updated,
        errors,
        total: allCustomers.length
      })

    } catch (error) {
      console.error('[SYNC] Error syncing customers:', error)
      clearProgress(`customers-${connectionId}`)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Ismeretlen hiba a szinkronizálás során'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[SYNC] Fatal error:', error)
    clearProgress(`customers-${connectionId}`)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Ismeretlen hiba'
    }, { status: 500 })
  }
}
