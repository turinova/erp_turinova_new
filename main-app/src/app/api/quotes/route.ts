import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Save quote (create or update)
export async function POST(request: NextRequest) {
  try {
    console.log('Saving quote...')
    
    const body = await request.json()
    const {
      quoteId, // if provided, this is an edit
      customerData,
      panels,
      optimizationResults,
      quoteCalculations
    } = body

    // Get current user using cookies
    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Current user for quote saving:', user.id, user.email)

    // Start transaction
    let customerId = customerData.id || null
    let shouldUpdateExistingCustomer = Boolean(customerId)

    // Handle customer creation or update
    if (customerData.name) {
      const trimmedName = customerData.name.trim()
      customerData.name = trimmedName

      // If no customerId provided, attempt to find existing active customer by name
      if (!customerId && trimmedName) {
        const { data: existingCustomer, error: existingLookupError } = await supabaseServer
          .from('customers')
          .select('id')
          .eq('name', trimmedName)
          .eq('is_active', true)
          .is('deleted_at', null)
          .maybeSingle()

        if (existingLookupError && existingLookupError.code !== 'PGRST116') {
          console.warn('Error looking up existing customer by name:', existingLookupError)
        }

        if (existingCustomer) {
          customerId = existingCustomer.id
          shouldUpdateExistingCustomer = true
          console.log('Using existing customer by name:', trimmedName, 'ID:', customerId)
        }
      }

      if (!customerId) {
        // Creating new customer (no existing customer found)
        console.log('Creating new customer:', trimmedName)

        const { data: newCustomer, error: customerError } = await supabaseServer
          .from('customers')
          .insert([{
            name: trimmedName,
            email: customerData.email || null,
            mobile: customerData.mobile || null,
            discount_percent: parseFloat(customerData.discount_percent) || 0,
            billing_name: customerData.billing_name || null,
            billing_country: customerData.billing_country || 'Magyarország',
            billing_city: customerData.billing_city || null,
            billing_postal_code: customerData.billing_postal_code || null,
            billing_street: customerData.billing_street || null,
            billing_house_number: customerData.billing_house_number || null,
            billing_tax_number: customerData.billing_tax_number || null,
            billing_company_reg_number: customerData.billing_company_reg_number || null
          }])
          .select('id')
          .single()

        if (customerError) {
          console.error('Error creating customer:', customerError)

          if (customerError.code === '23505') {
            const { data: existingCustomer } = await supabaseServer
              .from('customers')
              .select('id')
              .eq('name', trimmedName)
              .eq('is_active', true)
              .is('deleted_at', null)
              .maybeSingle()

            if (existingCustomer) {
              customerId = existingCustomer.id
              shouldUpdateExistingCustomer = true
              console.log('Duplicate customer detected. Using existing customer ID:', customerId)
            } else {
              return NextResponse.json({
                error: 'Customer already exists with this name',
                details: customerError.message
              }, { status: 409 })
            }
          } else {
            return NextResponse.json({
              error: 'Failed to create customer',
              details: customerError.message
            }, { status: 500 })
          }
        } else {
          customerId = newCustomer.id
          shouldUpdateExistingCustomer = false
          console.log('Customer created successfully:', customerId)
        }
      }

      if (customerId && shouldUpdateExistingCustomer) {
        console.log('Updating existing customer details:', trimmedName, 'ID:', customerId)

        const { error: updateError } = await supabaseServer
          .from('customers')
          .update({
            email: customerData.email || null,
            mobile: customerData.mobile || null,
            discount_percent: parseFloat(customerData.discount_percent) || 0,
            billing_name: customerData.billing_name || null,
            billing_country: customerData.billing_country || 'Magyarország',
            billing_city: customerData.billing_city || null,
            billing_postal_code: customerData.billing_postal_code || null,
            billing_street: customerData.billing_street || null,
            billing_house_number: customerData.billing_house_number || null,
            billing_tax_number: customerData.billing_tax_number || null,
            billing_company_reg_number: customerData.billing_company_reg_number || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId)

        if (updateError) {
          console.error('Error updating customer:', updateError)
          return NextResponse.json({
            error: 'Failed to update customer',
            details: updateError.message
          }, { status: 500 })
        }

        console.log('Customer updated successfully:', customerId)
      }
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
    }

    // If editing existing quote, delete old data (CASCADE will handle related tables)
    if (quoteId) {
      console.log('Deleting existing quote data for quote:', quoteId)
      
      const { error: deletePanelsError } = await supabaseServer
        .from('quote_panels')
        .delete()
        .eq('quote_id', quoteId)
      
      const { error: deletePricingError } = await supabaseServer
        .from('quote_materials_pricing')
        .delete()
        .eq('quote_id', quoteId)

      if (deletePanelsError || deletePricingError) {
        console.error('Error deleting old quote data:', deletePanelsError || deletePricingError)
      }
    }

    // Generate quote number if new quote
    let quoteNumber = body.quoteNumber
    if (!quoteId) {
      const { data: generatedNumber, error: genError } = await supabaseServer
        .rpc('generate_quote_number')
      
      if (genError) {
        console.error('Error generating quote number:', genError)
        return NextResponse.json({ 
          error: 'Failed to generate quote number',
          details: genError.message
        }, { status: 500 })
      }
      
      quoteNumber = generatedNumber
      console.log('Generated quote number:', quoteNumber)
    }

    // Calculate totals
    const totalNet = quoteCalculations.total_net
    const totalVat = quoteCalculations.total_vat
    const totalGross = quoteCalculations.total_gross
    const discountPercent = parseFloat(customerData.discount_percent) || 0
    const finalTotal = totalGross * (1 - discountPercent / 100)

    // Create or update quote
    const quoteData: any = {
      customer_id: customerId,
      quote_number: quoteNumber,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      discount_percent: discountPercent,
      final_total_after_discount: finalTotal,
      updated_at: new Date().toISOString()
    }

    // Only set status for NEW quotes, not when updating
    if (!quoteId) {
      quoteData.status = body.status || 'draft'
      quoteData.created_by = user.id
    }

    let finalQuoteId = quoteId
    let finalQuoteNumber = quoteNumber

    if (quoteId) {
      // Check if quote is currently in_production
      const { data: existingQuote } = await supabaseServer
        .from('quotes')
        .select('status')
        .eq('id', quoteId)
        .single()

      // If editing an in_production order, clear production data and revert to ordered
      if (existingQuote && existingQuote.status === 'in_production') {
        console.log('Clearing production data for in_production order')
        quoteData.production_machine_id = null
        quoteData.production_date = null
        quoteData.barcode = null
        quoteData.status = 'ordered'
      }

      // Update existing quote - DON'T change status or order_number (unless clearing production)
      const { data: updatedQuote, error: quoteError } = await supabaseServer
        .from('quotes')
        .update(quoteData)
        .eq('id', quoteId)
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('Error updating quote:', quoteError)
        return NextResponse.json({ 
          error: 'Failed to update quote',
          details: quoteError.message
        }, { status: 500 })
      }

      finalQuoteNumber = updatedQuote.quote_number
      console.log('Quote updated successfully:', updatedQuote.quote_number)
    } else {
      // Create new quote
      const { data: newQuote, error: quoteError } = await supabaseServer
        .from('quotes')
        .insert([quoteData])
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('Error creating quote:', quoteError)
        return NextResponse.json({ 
          error: 'Failed to create quote',
          details: quoteError.message
        }, { status: 500 })
      }

      finalQuoteId = newQuote.id
      finalQuoteNumber = newQuote.quote_number
      console.log('Quote created successfully:', newQuote.quote_number)
    }

    // Insert panels
    const panelInserts = panels.map((panel: any) => ({
      quote_id: finalQuoteId,
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

    const { error: panelsError } = await supabaseServer
      .from('quote_panels')
      .insert(panelInserts)

    if (panelsError) {
      console.error('Error inserting panels:', panelsError)
      return NextResponse.json({ 
        error: 'Failed to save panels',
        details: panelsError.message
      }, { status: 500 })
    }

    console.log(`Inserted ${panelInserts.length} panels`)

    // Insert materials pricing for each material
    for (const materialPricing of quoteCalculations.materials) {
      // Insert material pricing
      const pricingData = {
        quote_id: finalQuoteId,
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

      const { data: insertedPricing, error: pricingError } = await supabaseServer
        .from('quote_materials_pricing')
        .insert([pricingData])
        .select('id')
        .single()

      if (pricingError) {
        console.error('Error inserting material pricing:', pricingError)
        return NextResponse.json({ 
          error: 'Failed to save material pricing',
          details: pricingError.message
        }, { status: 500 })
      }

      const pricingId = insertedPricing.id

      // Insert edge materials breakdown
      if (materialPricing.edge_materials && materialPricing.edge_materials.length > 0) {
        const edgeInserts = materialPricing.edge_materials.map((edge: any) => ({
          quote_materials_pricing_id: pricingId,
          edge_material_id: edge.edge_material_id,
          edge_material_name: edge.name,
          total_length_m: edge.total_length_m,
          price_per_m: edge.price_per_m,
          net_price: edge.net,
          vat_amount: edge.vat,
          gross_price: edge.gross
        }))

        const { error: edgeError } = await supabaseServer
          .from('quote_edge_materials_breakdown')
          .insert(edgeInserts)

        if (edgeError) {
          console.error('Error inserting edge materials:', edgeError)
        }
      }

      // Insert services breakdown
      if (materialPricing.additional_services) {
        const serviceInserts = []

        if (materialPricing.additional_services.panthelyfuras) {
          serviceInserts.push({
            quote_materials_pricing_id: pricingId,
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
            quote_materials_pricing_id: pricingId,
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
            quote_materials_pricing_id: pricingId,
            service_type: 'szogvagas',
            quantity: materialPricing.additional_services.szogvagas.quantity,
            unit_price: materialPricing.additional_services.szogvagas.unit_price,
            net_price: materialPricing.additional_services.szogvagas.net_price,
            vat_amount: materialPricing.additional_services.szogvagas.vat_amount,
            gross_price: materialPricing.additional_services.szogvagas.gross_price
          })
        }

        if (serviceInserts.length > 0) {
          const { error: servicesError } = await supabaseServer
            .from('quote_services_breakdown')
            .insert(serviceInserts)

          if (servicesError) {
            console.error('Error inserting services:', servicesError)
          }
        }
      }
    }

    console.log('Quote saved successfully!')

    // Recalculate totals to include fees and accessories (if any exist)
    // This is especially important when editing existing quotes/orders
    if (quoteId) {
      console.log('Recalculating totals to include fees and accessories...')
      
      // Import and call recalculateQuoteTotals
      const { recalculateQuoteTotals } = await import('./[id]/fees/route')
      await recalculateQuoteTotals(finalQuoteId)
    }

    // Fetch the saved quote to get order_number if it exists
    const { data: savedQuote } = await supabaseServer
      .from('quotes')
      .select('order_number')
      .eq('id', finalQuoteId)
      .single()

    return NextResponse.json({
      success: true,
      message: 'Árajánlat sikeresen mentve',
      quoteId: finalQuoteId,
      quoteNumber: finalQuoteNumber,
      orderNumber: savedQuote?.order_number || null
    }, { status: quoteId ? 200 : 201 })

  } catch (error) {
    console.error('Error saving quote:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - List all quotes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    let query = supabaseServer
      .from('quotes')
      .select(`
        id,
        quote_number,
        status,
        total_net,
        total_vat,
        total_gross,
        discount_percent,
        final_total_after_discount,
        created_at,
        updated_at,
        customers(id, name, email)
      `)
      .is('deleted_at', null)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data: quotes, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
    }

    return NextResponse.json(quotes || [])
    
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

