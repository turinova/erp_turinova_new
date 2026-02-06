import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Save worktop quote (create or update)
export async function POST(request: NextRequest) {
  try {
    console.log('Saving worktop quote...')
    
    const body = await request.json()
    const {
      quoteId, // if provided, this is an edit
      customerData,
      savedConfigs, // Array of SavedWorktopConfig
      quoteCalculations // quoteResult data
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
    
    console.log('Current user for worktop quote saving:', user.id, user.email)

    // Start transaction
    let customerId = customerData.id || null
    let shouldUpdateExistingCustomer = Boolean(customerId)

    // Handle customer creation or update (same logic as quotes)
    if (customerData.name) {
      const trimmedName = customerData.name.trim()
      customerData.name = trimmedName

      // If no customerId provided, attempt to find existing active customer by name
      if (!customerId && trimmedName) {
        const { data: existingCustomer, error: existingLookupError } = await supabaseServer
          .from('customers')
          .select('id')
          .eq('name', trimmedName)
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
        // Creating new customer
        console.log('Creating new customer:', trimmedName)

        const { data: newCustomer, error: customerError } = await supabaseServer
          .from('customers')
          .insert([{
            name: trimmedName,
            email: customerData.email || null,
            mobile: customerData.phone || null,
            discount_percent: parseFloat(customerData.discount) || 0,
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
            mobile: customerData.phone || null,
            discount_percent: parseFloat(customerData.discount) || 0,
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

    // Validate required data
    if (!savedConfigs || !Array.isArray(savedConfigs) || savedConfigs.length === 0) {
      return NextResponse.json({ error: 'At least one saved configuration is required' }, { status: 400 })
    }

    if (!quoteCalculations) {
      return NextResponse.json({ error: 'Quote calculations are required' }, { status: 400 })
    }

    // If editing existing quote, delete old data (CASCADE will handle related tables)
    if (quoteId) {
      console.log('Deleting existing worktop quote data for quote:', quoteId)
      
      const { error: deleteConfigsError } = await supabaseServer
        .from('worktop_quote_configs')
        .delete()
        .eq('worktop_quote_id', quoteId)
      
      const { error: deletePricingError } = await supabaseServer
        .from('worktop_quote_materials_pricing')
        .delete()
        .eq('worktop_quote_id', quoteId)

      if (deleteConfigsError || deletePricingError) {
        console.error('Error deleting old worktop quote data:', deleteConfigsError || deletePricingError)
      }
    }

    // Generate quote number if new quote
    let quoteNumber = body.quoteNumber
    if (!quoteId) {
      const { data: generatedNumber, error: genError } = await supabaseServer
        .rpc('generate_worktop_quote_number')
      
      if (genError) {
        console.error('Error generating worktop quote number:', genError)
        return NextResponse.json({ 
          error: 'Failed to generate quote number',
          details: genError.message
        }, { status: 500 })
      }
      
      quoteNumber = generatedNumber
      console.log('Generated worktop quote number:', quoteNumber)
    }

    // Calculate totals
    const totalNet = quoteCalculations.grand_total_net
    const totalVat = quoteCalculations.grand_total_vat
    const totalGross = quoteCalculations.grand_total_gross
    const discountPercent = parseFloat(customerData.discount) || 0
    const finalTotal = totalGross * (1 - discountPercent / 100)

    // Get currency_id and vat_id from worktop config fees
    const { data: worktopConfigFees } = await supabaseServer
      .from('worktop_config_fees')
      .select('currency_id, vat_id')
      .limit(1)
      .maybeSingle()

    // Create or update worktop quote
    const quoteData: any = {
      customer_id: customerId,
      quote_number: quoteNumber,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      discount_percent: discountPercent,
      final_total_after_discount: finalTotal,
      currency_id: worktopConfigFees?.currency_id || null,
      vat_id: worktopConfigFees?.vat_id || null,
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
      // Update existing quote
      const { data: updatedQuote, error: quoteError } = await supabaseServer
        .from('worktop_quotes')
        .update(quoteData)
        .eq('id', quoteId)
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('Error updating worktop quote:', quoteError)
        return NextResponse.json({ 
          error: 'Failed to update worktop quote',
          details: quoteError.message
        }, { status: 500 })
      }

      finalQuoteNumber = updatedQuote.quote_number
      console.log('Worktop quote updated successfully:', updatedQuote.quote_number)
    } else {
      // Create new quote
      const { data: newQuote, error: quoteError } = await supabaseServer
        .from('worktop_quotes')
        .insert([quoteData])
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('Error creating worktop quote:', quoteError)
        return NextResponse.json({ 
          error: 'Failed to create worktop quote',
          details: quoteError.message
        }, { status: 500 })
      }

      finalQuoteId = newQuote.id
      finalQuoteNumber = newQuote.quote_number
      console.log('Worktop quote created successfully:', newQuote.quote_number)
    }

    // Insert configs
    const configInserts = savedConfigs.map((config: any, index: number) => {
      // Get material name for snapshot
      const material = quoteCalculations.materials.find((m: any) => 
        m.material_id === config.selectedLinearMaterialId
      )
      const materialName = material?.material_name || 'Unknown Material'

      return {
        worktop_quote_id: finalQuoteId,
        config_order: index + 1,
        assembly_type: config.assemblyType || '',
        linear_material_id: config.selectedLinearMaterialId || '',
        linear_material_name: materialName,
        edge_banding: config.edgeBanding || 'Nincs élzáró',
        edge_color_choice: config.edgeColorChoice || 'Színazonos',
        edge_color_text: config.edgeColorText || null,
        no_postforming_edge: config.noPostformingEdge || false,
        edge_position1: config.edgePosition1 || false,
        edge_position2: config.edgePosition2 || false,
        edge_position3: config.edgePosition3 || false,
        edge_position4: config.edgePosition4 || false,
        edge_position5: config.edgePosition5 || false,
        edge_position6: config.edgePosition6 || false,
        dimension_a: parseFloat(config.dimensionA) || 0,
        dimension_b: parseFloat(config.dimensionB) || 0,
        dimension_c: config.dimensionC ? parseFloat(config.dimensionC) : null,
        dimension_d: config.dimensionD ? parseFloat(config.dimensionD) : null,
        dimension_e: config.dimensionE ? parseFloat(config.dimensionE) : null,
        dimension_f: config.dimensionF ? parseFloat(config.dimensionF) : null,
        rounding_r1: config.roundingR1 ? parseFloat(config.roundingR1) : null,
        rounding_r2: config.roundingR2 ? parseFloat(config.roundingR2) : null,
        rounding_r3: config.roundingR3 ? parseFloat(config.roundingR3) : null,
        rounding_r4: config.roundingR4 ? parseFloat(config.roundingR4) : null,
        cut_l1: config.cutL1 ? parseFloat(config.cutL1) : null,
        cut_l2: config.cutL2 ? parseFloat(config.cutL2) : null,
        cut_l3: config.cutL3 ? parseFloat(config.cutL3) : null,
        cut_l4: config.cutL4 ? parseFloat(config.cutL4) : null,
        cut_l5: config.cutL5 ? parseFloat(config.cutL5) : null,
        cut_l6: config.cutL6 ? parseFloat(config.cutL6) : null,
        cut_l7: config.cutL7 ? parseFloat(config.cutL7) : null,
        cut_l8: config.cutL8 ? parseFloat(config.cutL8) : null,
        cutouts: config.cutouts && config.cutouts.length > 0 ? JSON.stringify(config.cutouts) : null
      }
    })

    const { error: configsError } = await supabaseServer
      .from('worktop_quote_configs')
      .insert(configInserts)

    if (configsError) {
      console.error('Error inserting worktop quote configs:', configsError)
      return NextResponse.json({ 
        error: 'Failed to save worktop configurations',
        details: configsError.message
      }, { status: 500 })
    }

    console.log(`Inserted ${configInserts.length} worktop configs`)

    // Insert materials pricing for each material/config
    const pricingInserts = quoteCalculations.materials.map((material: any, index: number) => ({
      worktop_quote_id: finalQuoteId,
      config_order: index + 1,
      material_id: material.material_id,
      material_name: material.material_name,
      currency: material.currency,
      on_stock: material.on_stock,
      anyag_koltseg_net: material.anyag_koltseg_net,
      anyag_koltseg_vat: material.anyag_koltseg_vat,
      anyag_koltseg_gross: material.anyag_koltseg_gross,
      anyag_koltseg_details: material.anyag_koltseg_details || null,
      kereszt_vagas_net: material.kereszt_vagas_net,
      kereszt_vagas_vat: material.kereszt_vagas_vat,
      kereszt_vagas_gross: material.kereszt_vagas_gross,
      kereszt_vagas_details: material.kereszt_vagas_details || null,
      hosszanti_vagas_net: material.hosszanti_vagas_net,
      hosszanti_vagas_vat: material.hosszanti_vagas_vat,
      hosszanti_vagas_gross: material.hosszanti_vagas_gross,
      hosszanti_vagas_details: material.hosszanti_vagas_details || null,
      ives_vagas_net: material.ives_vagas_net,
      ives_vagas_vat: material.ives_vagas_vat,
      ives_vagas_gross: material.ives_vagas_gross,
      ives_vagas_details: material.ives_vagas_details || null,
      szogvagas_net: material.szogvagas_net,
      szogvagas_vat: material.szogvagas_vat,
      szogvagas_gross: material.szogvagas_gross,
      szogvagas_details: material.szogvagas_details || null,
      kivagas_net: material.kivagas_net,
      kivagas_vat: material.kivagas_vat,
      kivagas_gross: material.kivagas_gross,
      kivagas_details: material.kivagas_details || null,
      elzaro_net: material.elzaro_net,
      elzaro_vat: material.elzaro_vat,
      elzaro_gross: material.elzaro_gross,
      elzaro_details: material.elzaro_details || null,
      osszemaras_net: material.osszemaras_net,
      osszemaras_vat: material.osszemaras_vat,
      osszemaras_gross: material.osszemaras_gross,
      osszemaras_details: material.osszemaras_details || null,
      total_net: material.total_net,
      total_vat: material.total_vat,
      total_gross: material.total_gross
    }))

    const { error: pricingError } = await supabaseServer
      .from('worktop_quote_materials_pricing')
      .insert(pricingInserts)

    if (pricingError) {
      console.error('Error inserting worktop quote materials pricing:', pricingError)
      return NextResponse.json({ 
        error: 'Failed to save worktop quote pricing',
        details: pricingError.message
      }, { status: 500 })
    }

    console.log(`Inserted ${pricingInserts.length} worktop quote materials pricing records`)

    return NextResponse.json({
      success: true,
      quoteId: finalQuoteId,
      quoteNumber: finalQuoteNumber
    })

  } catch (error) {
    console.error('Error in worktop-quotes POST:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
