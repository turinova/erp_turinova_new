import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * POST - Submit portal quote to company database
 * 
 * This copies a portal quote from customer portal DB to the company's main app DB.
 * Workflow:
 * 1. Fetch complete portal quote data
 * 2. Get company database credentials
 * 3. Find or create customer in company DB
 * 4. Generate company quote number
 * 5. Copy quote + panels + pricing + edges + services to company DB
 * 6. Update portal quote status to 'submitted'
 * 7. Link portal quote to company quote
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Portal Quote Submit] Starting submission...')
    
    const body = await request.json()
    const { quoteId, paymentMethodId } = body

    if (!quoteId) {
      return NextResponse.json({ 
        error: 'Quote ID is required' 
      }, { status: 400 })
    }

    if (!paymentMethodId) {
      return NextResponse.json({ 
        error: 'Payment method ID is required' 
      }, { status: 400 })
    }

    // Get current authenticated portal customer
    const cookieStore = await cookies()
    const portalSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              console.error('[Portal Quote Submit] Error setting cookies:', error)
            }
          },
        },
      }
    )
    
    const { data: { user }, error: userError } = await portalSupabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Portal Quote Submit] Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Portal Quote Submit] Customer:', user.id, 'Quote:', quoteId, 'Payment Method:', paymentMethodId)

    // Step 1: Fetch complete portal quote data
    const { data: portalQuote, error: quoteError } = await portalSupabase
      .from('portal_quotes')
      .select(`
        *,
        portal_customers!inner (
          id, name, email, mobile, discount_percent,
          billing_name, billing_country, billing_city, billing_postal_code,
          billing_street, billing_house_number, billing_tax_number, billing_company_reg_number
        ),
        companies!inner (id, name, supabase_url, supabase_anon_key)
      `)
      .eq('id', quoteId)
      .eq('portal_customer_id', user.id) // Ensure only own quotes
      .eq('status', 'draft') // Only draft quotes can be submitted
      .single()

    if (quoteError || !portalQuote) {
      console.error('[Portal Quote Submit] Quote not found or already submitted:', quoteError)
      return NextResponse.json({ 
        error: 'Quote not found or already submitted' 
      }, { status: 404 })
    }

    // Fetch panels
    const { data: panels, error: panelsError } = await portalSupabase
      .from('portal_quote_panels')
      .select('*')
      .eq('portal_quote_id', quoteId)

    if (panelsError) {
      console.error('[Portal Quote Submit] Error fetching panels:', panelsError)
      return NextResponse.json({ 
        error: 'Failed to fetch quote panels',
        details: panelsError.message
      }, { status: 500 })
    }

    // Fetch pricing with breakdowns
    const { data: pricing, error: pricingError } = await portalSupabase
      .from('portal_quote_materials_pricing')
      .select(`
        *,
        portal_quote_edge_materials_breakdown (*),
        portal_quote_services_breakdown (*)
      `)
      .eq('portal_quote_id', quoteId)

    if (pricingError) {
      console.error('[Portal Quote Submit] Error fetching pricing:', pricingError)
      return NextResponse.json({ 
        error: 'Failed to fetch quote pricing',
        details: pricingError.message
      }, { status: 500 })
    }

    console.log(`[Portal Quote Submit] Loaded quote data: ${panels?.length || 0} panels, ${pricing?.length || 0} materials`)

    // Step 2: Create company database client
    const companySupabase = createClient(
      portalQuote.companies.supabase_url,
      portalQuote.companies.supabase_anon_key
    )

    console.log('[Portal Quote Submit] Connected to company database:', portalQuote.companies.name)

    // Step 3: Find or create customer in company database
    const portalCustomer = portalQuote.portal_customers
    let companyCustomerId = null

    // Try to find existing customer by email
    const { data: existingCustomer, error: findError } = await companySupabase
      .from('customers')
      .select('id')
      .eq('email', portalCustomer.email)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingCustomer) {
      companyCustomerId = existingCustomer.id
      console.log('[Portal Quote Submit] Found existing customer in company DB:', companyCustomerId)
    } else {
      // Create new customer in company database
      console.log('[Portal Quote Submit] Creating new customer in company DB')
      
      const { data: newCustomer, error: createError } = await companySupabase
        .from('customers')
        .insert([{
          name: portalCustomer.name,
          email: portalCustomer.email,
          mobile: portalCustomer.mobile || '',
          discount_percent: portalCustomer.discount_percent || 0,
          billing_name: portalCustomer.billing_name || '',
          billing_country: portalCustomer.billing_country || 'Magyarország',
          billing_city: portalCustomer.billing_city || '',
          billing_postal_code: portalCustomer.billing_postal_code || '',
          billing_street: portalCustomer.billing_street || '',
          billing_house_number: portalCustomer.billing_house_number || '',
          billing_tax_number: portalCustomer.billing_tax_number || '',
          billing_company_reg_number: portalCustomer.billing_company_reg_number || ''
        }])
        .select('id')
        .single()

      if (createError || !newCustomer) {
        console.error('[Portal Quote Submit] Error creating customer:', createError)
        return NextResponse.json({ 
          error: 'Failed to create customer in company database',
          details: createError?.message
        }, { status: 500 })
      }

      companyCustomerId = newCustomer.id
      console.log('[Portal Quote Submit] Created new customer:', companyCustomerId)
    }

    // Step 4: Generate company quote number
    const { data: companyQuoteNumber, error: genError } = await companySupabase
      .rpc('generate_quote_number')

    if (genError || !companyQuoteNumber) {
      console.error('[Portal Quote Submit] Error generating quote number:', genError)
      return NextResponse.json({ 
        error: 'Failed to generate quote number',
        details: genError?.message
      }, { status: 500 })
    }

    console.log('[Portal Quote Submit] Generated company quote number:', companyQuoteNumber)

    // Step 5: Create quote in company database
    // Use fixed system user ID for customer portal submissions
    const CUSTOMER_PORTAL_SYSTEM_USER_ID = 'c0000000-0000-0000-0000-000000000001'
    
    const { data: companyQuote, error: companyQuoteError} = await companySupabase
      .from('quotes')
      .insert([{
        customer_id: companyCustomerId,
        quote_number: companyQuoteNumber,
        status: 'draft',
        source: 'customer_portal', // Mark as customer portal submission
        payment_method_id: paymentMethodId, // Set payment method from customer selection
        comment: portalQuote.comment || null, // Copy comment from portal quote
        total_net: portalQuote.total_net,
        total_vat: portalQuote.total_vat,
        total_gross: portalQuote.total_gross,
        discount_percent: portalQuote.discount_percent,
        final_total_after_discount: portalQuote.final_total_after_discount,
        fees_total_net: 0,
        fees_total_vat: 0,
        fees_total_gross: 0,
        accessories_total_net: 0,
        accessories_total_vat: 0,
        accessories_total_gross: 0,
        created_by: CUSTOMER_PORTAL_SYSTEM_USER_ID // System user for customer portal
      }])
      .select('id, quote_number')
      .single()

    if (companyQuoteError || !companyQuote) {
      console.error('[Portal Quote Submit] Error creating quote in company DB:', companyQuoteError)
      return NextResponse.json({ 
        error: 'Failed to create quote in company database',
        details: companyQuoteError?.message
      }, { status: 500 })
    }

    const companyQuoteId = companyQuote.id
    console.log('[Portal Quote Submit] Created quote in company DB:', companyQuoteNumber)

    // Step 6: Copy panels to company database
    if (panels && panels.length > 0) {
      const panelInserts = panels.map((panel: any) => ({
        quote_id: companyQuoteId,
        material_id: panel.material_id,
        width_mm: panel.width_mm,
        height_mm: panel.height_mm,
        quantity: panel.quantity,
        label: panel.label || null,
        edge_material_a_id: panel.edge_material_a_id || null,
        edge_material_b_id: panel.edge_material_b_id || null,
        edge_material_c_id: panel.edge_material_c_id || null,
        edge_material_d_id: panel.edge_material_d_id || null,
        panthelyfuras_quantity: panel.panthelyfuras_quantity || 0,
        panthelyfuras_oldal: panel.panthelyfuras_oldal || null,
        duplungolas: panel.duplungolas || false,
        szogvagas: panel.szogvagas || false
      }))

      const { error: panelsError } = await companySupabase
        .from('quote_panels')
        .insert(panelInserts)

      if (panelsError) {
        console.error('[Portal Quote Submit] Error copying panels:', panelsError)
        return NextResponse.json({ 
          error: 'Failed to copy panels to company database',
          details: panelsError.message
        }, { status: 500 })
      }

      console.log(`[Portal Quote Submit] Copied ${panelInserts.length} panels`)
    }

    // Step 7: Copy materials pricing to company database
    if (pricing && pricing.length > 0) {
      for (const materialPricing of pricing) {
        // Insert material pricing
        const { data: insertedPricing, error: pricingInsertError } = await companySupabase
          .from('quote_materials_pricing')
          .insert([{
            quote_id: companyQuoteId,
            material_id: materialPricing.material_id,
            material_name: materialPricing.material_name,
            board_width_mm: materialPricing.board_width_mm,
            board_length_mm: materialPricing.board_length_mm,
            thickness_mm: materialPricing.thickness_mm,
            grain_direction: materialPricing.grain_direction,
            on_stock: materialPricing.on_stock,
            boards_used: materialPricing.boards_used,
            usage_percentage: materialPricing.usage_percentage,
            pricing_method: materialPricing.pricing_method,
            charged_sqm: materialPricing.charged_sqm,
            price_per_sqm: materialPricing.price_per_sqm,
            vat_rate: materialPricing.vat_rate,
            currency: materialPricing.currency,
            usage_limit: materialPricing.usage_limit,
            waste_multi: materialPricing.waste_multi,
            material_net: materialPricing.material_net,
            material_vat: materialPricing.material_vat,
            material_gross: materialPricing.material_gross,
            edge_materials_net: materialPricing.edge_materials_net,
            edge_materials_vat: materialPricing.edge_materials_vat,
            edge_materials_gross: materialPricing.edge_materials_gross,
            cutting_length_m: materialPricing.cutting_length_m,
            cutting_net: materialPricing.cutting_net,
            cutting_vat: materialPricing.cutting_vat,
            cutting_gross: materialPricing.cutting_gross,
            services_net: materialPricing.services_net,
            services_vat: materialPricing.services_vat,
            services_gross: materialPricing.services_gross,
            total_net: materialPricing.total_net,
            total_vat: materialPricing.total_vat,
            total_gross: materialPricing.total_gross
          }])
          .select('id')
          .single()

        if (pricingInsertError || !insertedPricing) {
          console.error('[Portal Quote Submit] Error copying material pricing:', pricingInsertError)
          return NextResponse.json({ 
            error: 'Failed to copy material pricing to company database',
            details: pricingInsertError?.message
          }, { status: 500 })
        }

        const companyPricingId = insertedPricing.id

        // Copy edge materials breakdown
        if (materialPricing.portal_quote_edge_materials_breakdown && 
            materialPricing.portal_quote_edge_materials_breakdown.length > 0) {
          
          const edgeInserts = materialPricing.portal_quote_edge_materials_breakdown.map((edge: any) => ({
            quote_materials_pricing_id: companyPricingId,
            edge_material_id: edge.edge_material_id,
            edge_material_name: edge.edge_material_name,
            total_length_m: edge.total_length_m,
            price_per_m: edge.price_per_m,
            net_price: edge.net_price,
            vat_amount: edge.vat_amount,
            gross_price: edge.gross_price
          }))

          const { error: edgeError } = await companySupabase
            .from('quote_edge_materials_breakdown')
            .insert(edgeInserts)

          if (edgeError) {
            console.error('[Portal Quote Submit] Error copying edge materials:', edgeError)
          }
        }

        // Copy services breakdown
        if (materialPricing.portal_quote_services_breakdown && 
            materialPricing.portal_quote_services_breakdown.length > 0) {
          
          const serviceInserts = materialPricing.portal_quote_services_breakdown.map((service: any) => ({
            quote_materials_pricing_id: companyPricingId,
            service_type: service.service_type,
            quantity: service.quantity,
            unit_price: service.unit_price,
            net_price: service.net_price,
            vat_amount: service.vat_amount,
            gross_price: service.gross_price
          }))

          const { error: serviceError } = await companySupabase
            .from('quote_services_breakdown')
            .insert(serviceInserts)

          if (serviceError) {
            console.error('[Portal Quote Submit] Error copying services:', serviceError)
          }
        }
      }

      console.log(`[Portal Quote Submit] Copied ${pricing.length} material pricing records`)
    }

    // Step 8: Update portal quote status to 'submitted'
    const { error: updateError } = await portalSupabase
      .from('portal_quotes')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_to_company_quote_id: companyQuoteId,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)

    if (updateError) {
      console.error('[Portal Quote Submit] Error updating portal quote status:', updateError)
      // Don't fail the entire submission - quote is already in company DB
      // Just log the error
    }

    console.log('[Portal Quote Submit] Successfully submitted quote!')
    console.log(`[Portal Quote Submit] Portal quote: ${portalQuote.quote_number} → Company quote: ${companyQuoteNumber}`)

    return NextResponse.json({
      success: true,
      message: 'Árajánlat sikeresen elküldve',
      portalQuoteNumber: portalQuote.quote_number,
      companyQuoteNumber: companyQuoteNumber,
      companyQuoteId: companyQuoteId
    }, { status: 200 })

  } catch (error) {
    console.error('[Portal Quote Submit] Error submitting portal quote:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

