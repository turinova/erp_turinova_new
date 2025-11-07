import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST - Save portal quote (create or update)
 * 
 * This API saves quotes for portal customers to the customer portal database.
 * It mirrors the main app's quote saving logic but saves to portal_* tables.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Portal Quotes API] Saving portal quote...')
    
    const body = await request.json()
    const {
      quoteId, // if provided, this is an edit (for future use)
      panels,
      optimizationResults,
      quoteCalculations
    } = body

    // Get current authenticated portal customer
    const cookieStore = await cookies()
    const supabase = createServerClient(
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
              console.error('[Portal Quotes API] Error setting cookies:', error)
            }
          },
        },
      }
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('[Portal Quotes API] Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('[Portal Quotes API] Portal customer:', user.id, user.email)

    // Get portal customer data (includes selected_company_id and discount_percent)
    const { data: portalCustomer, error: customerError } = await supabase
      .from('portal_customers')
      .select('id, selected_company_id, discount_percent')
      .eq('id', user.id)
      .single()

    if (customerError || !portalCustomer) {
      console.error('[Portal Quotes API] Portal customer not found:', customerError)
      return NextResponse.json({ error: 'Portal customer not found' }, { status: 404 })
    }

    if (!portalCustomer.selected_company_id) {
      return NextResponse.json({ 
        error: 'No company selected. Please select a company in settings.' 
      }, { status: 400 })
    }

    const portalCustomerId = portalCustomer.id
    const targetCompanyId = portalCustomer.selected_company_id
    const discountPercent = portalCustomer.discount_percent || 0

    console.log('[Portal Quotes API] Saving quote for customer:', portalCustomerId, 'company:', targetCompanyId)

    // If editing existing quote, delete old data (CASCADE will handle related tables)
    if (quoteId) {
      console.log('[Portal Quotes API] Deleting existing quote data for quote:', quoteId)
      
      const { error: deletePanelsError } = await supabase
        .from('portal_quote_panels')
        .delete()
        .eq('portal_quote_id', quoteId)
      
      const { error: deletePricingError } = await supabase
        .from('portal_quote_materials_pricing')
        .delete()
        .eq('portal_quote_id', quoteId)

      if (deletePanelsError || deletePricingError) {
        console.error('[Portal Quotes API] Error deleting old quote data:', deletePanelsError || deletePricingError)
      }
    }

    // Generate quote number if new quote
    let quoteNumber = body.quoteNumber

    // Calculate totals
    const totalNet = quoteCalculations.total_net
    const totalVat = quoteCalculations.total_vat
    const totalGross = quoteCalculations.total_gross
    const finalTotal = totalGross * (1 - discountPercent / 100)

    // Create or update portal quote
    const baseQuoteData: any = {
      portal_customer_id: portalCustomerId,
      target_company_id: targetCompanyId,
      status: 'draft',
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      discount_percent: discountPercent,
      final_total_after_discount: finalTotal,
      fees_total_net: 0,
      fees_total_vat: 0,
      fees_total_gross: 0,
      accessories_total_net: 0,
      accessories_total_vat: 0,
      accessories_total_gross: 0,
      submitted_at: null,
      submitted_to_company_quote_id: null,
      updated_at: new Date().toISOString()
    }

    let finalQuoteId = quoteId
    let finalQuoteNumber = quoteNumber

    if (quoteId) {
      if (!quoteNumber) {
        console.warn('[Portal Quotes API] Missing quote number on update, keeping existing value')
      }
      const updatePayload = {
        ...baseQuoteData,
        quote_number: quoteNumber
      }
      // Update existing quote
      const { data: updatedQuote, error: quoteError } = await supabase
        .from('portal_quotes')
        .update(updatePayload)
        .eq('id', quoteId)
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('[Portal Quotes API] Error updating quote:', quoteError)
        return NextResponse.json({ 
          error: 'Failed to update quote',
          details: quoteError.message
        }, { status: 500 })
      }

      finalQuoteNumber = updatedQuote.quote_number
      console.log('[Portal Quotes API] Quote updated successfully:', updatedQuote.quote_number)
    } else {
      const maxAttempts = 3
      let attempt = 0
      let lastError: any = null

      while (attempt < maxAttempts) {
        attempt += 1

        const { data: generatedNumber, error: genError } = await supabase
          .rpc('generate_portal_quote_number')

        if (genError) {
          console.error('[Portal Quotes API] Error generating quote number (attempt', attempt, '):', genError)
          lastError = genError
          break
        }

        quoteNumber = generatedNumber
        console.log(`[Portal Quotes API] Generated quote number (attempt ${attempt}):`, quoteNumber)

        const insertPayload = {
          ...baseQuoteData,
          quote_number: quoteNumber
        }

        const { data: newQuote, error: quoteError } = await supabase
          .from('portal_quotes')
          .insert([insertPayload])
          .select('id, quote_number')
          .single()

        if (!quoteError) {
          finalQuoteId = newQuote.id
          finalQuoteNumber = newQuote.quote_number
          console.log('[Portal Quotes API] Quote created successfully:', newQuote.quote_number)
          break
        }

        console.error('[Portal Quotes API] Error creating quote (attempt', attempt, '):', quoteError)
        lastError = quoteError

        if (quoteError.code !== '23505') {
          break
        }

        console.warn('[Portal Quotes API] Duplicate quote number detected, retrying...')
      }

      if (!finalQuoteId) {
        const details = lastError?.message || 'Unknown error'
        console.error('[Portal Quotes API] Failed to create quote after retries')
        return NextResponse.json({
          error: 'Failed to create quote',
          details
        }, { status: 500 })
      }
    }

    // Insert panels (material_id and edge_material IDs are from company database)
    const panelInserts = panels.map((panel: any) => ({
      portal_quote_id: finalQuoteId,
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

    const { error: panelsError } = await supabase
      .from('portal_quote_panels')
      .insert(panelInserts)

    if (panelsError) {
      console.error('[Portal Quotes API] Error inserting panels:', panelsError)
      return NextResponse.json({ 
        error: 'Failed to save panels',
        details: panelsError.message
      }, { status: 500 })
    }

    console.log(`[Portal Quotes API] Inserted ${panelInserts.length} panels`)

    // Insert materials pricing for each material
    for (const materialPricing of quoteCalculations.materials) {
      // Insert material pricing
      const pricingData = {
        portal_quote_id: finalQuoteId,
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
        material_net: materialPricing.material_cost.net,
        material_vat: materialPricing.material_cost.vat,
        material_gross: materialPricing.material_cost.gross,
        edge_materials_net: materialPricing.edge_materials_cost.net,
        edge_materials_vat: materialPricing.edge_materials_cost.vat,
        edge_materials_gross: materialPricing.edge_materials_cost.gross,
        cutting_length_m: materialPricing.cutting_cost.length_m,
        cutting_net: materialPricing.cutting_cost.net,
        cutting_vat: materialPricing.cutting_cost.vat,
        cutting_gross: materialPricing.cutting_cost.gross,
        services_net: materialPricing.total_services_net,
        services_vat: materialPricing.total_services_vat,
        services_gross: materialPricing.total_services_gross,
        total_net: materialPricing.total.net,
        total_vat: materialPricing.total.vat,
        total_gross: materialPricing.total.gross
      }

      const { data: insertedPricing, error: pricingError } = await supabase
        .from('portal_quote_materials_pricing')
        .insert([pricingData])
        .select('id')
        .single()

      if (pricingError) {
        console.error('[Portal Quotes API] Error inserting material pricing:', pricingError)
        console.error('[Portal Quotes API] Pricing data that failed:', JSON.stringify(pricingData, null, 2))
        return NextResponse.json({ 
          error: 'Failed to save material pricing',
          details: pricingError.message,
          code: pricingError.code,
          hint: pricingError.hint
        }, { status: 500 })
      }

      const pricingId = insertedPricing.id

      // Insert edge materials breakdown
      if (materialPricing.edge_materials && materialPricing.edge_materials.length > 0) {
        const edgeInserts = materialPricing.edge_materials.map((edge: any) => ({
          portal_quote_materials_pricing_id: pricingId,
          edge_material_id: edge.edge_material_id,
          edge_material_name: edge.name,
          total_length_m: edge.total_length_m,
          price_per_m: edge.price_per_m,
          net_price: edge.net,
          vat_amount: edge.vat,
          gross_price: edge.gross
        }))

        const { error: edgeError } = await supabase
          .from('portal_quote_edge_materials_breakdown')
          .insert(edgeInserts)

        if (edgeError) {
          console.error('[Portal Quotes API] Error inserting edge materials:', edgeError)
        }
      }

      // Insert services breakdown
      if (materialPricing.additional_services) {
        const serviceInserts = []

        if (materialPricing.additional_services.panthelyfuras) {
          serviceInserts.push({
            portal_quote_materials_pricing_id: pricingId,
            service_type: 'panthelyfuras',
            quantity: materialPricing.additional_services.panthelyfuras.quantity,
            unit_price: materialPricing.additional_services.panthelyfuras.unit_price,
            net_price: materialPricing.additional_services.panthelyfuras.net_price,
            vat_amount: materialPricing.additional_services.panthelyfuras.vat_amount,
            gross_price: materialPricing.additional_services.panthelyfuras.gross_price
          })
        }

        if (materialPricing.additional_services.duplungolas) {
          serviceInserts.push({
            portal_quote_materials_pricing_id: pricingId,
            service_type: 'duplungolas',
            quantity: materialPricing.additional_services.duplungolas.quantity,
            unit_price: materialPricing.additional_services.duplungolas.unit_price,
            net_price: materialPricing.additional_services.duplungolas.net_price,
            vat_amount: materialPricing.additional_services.duplungolas.vat_amount,
            gross_price: materialPricing.additional_services.duplungolas.gross_price
          })
        }

        if (materialPricing.additional_services.szogvagas) {
          serviceInserts.push({
            portal_quote_materials_pricing_id: pricingId,
            service_type: 'szogvagas',
            quantity: materialPricing.additional_services.szogvagas.quantity,
            unit_price: materialPricing.additional_services.szogvagas.unit_price,
            net_price: materialPricing.additional_services.szogvagas.net_price,
            vat_amount: materialPricing.additional_services.szogvagas.vat_amount,
            gross_price: materialPricing.additional_services.szogvagas.gross_price
          })
        }

        if (serviceInserts.length > 0) {
          const { error: servicesError } = await supabase
            .from('portal_quote_services_breakdown')
            .insert(serviceInserts)

          if (servicesError) {
            console.error('[Portal Quotes API] Error inserting services:', servicesError)
          }
        }
      }
    }

    console.log('[Portal Quotes API] Portal quote saved successfully!')

    return NextResponse.json({
      success: true,
      message: 'Árajánlat sikeresen mentve',
      quoteId: finalQuoteId,
      quoteNumber: finalQuoteNumber
    }, { status: quoteId ? 200 : 201 })

  } catch (error) {
    console.error('[Portal Quotes API] Error saving portal quote:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
