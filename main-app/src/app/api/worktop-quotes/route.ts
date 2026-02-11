import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// POST - Save worktop quote (create or update)
export async function POST(request: NextRequest) {
  try {
    console.log('=== WORKTOP QUOTE SAVE START ===')
    console.log('Timestamp:', new Date().toISOString())
    
    const body = await request.json()
    console.log('Request body keys:', Object.keys(body))
    console.log('Quote ID (if editing):', body.quoteId)
    console.log('Customer data present:', !!body.customerData)
    console.log('Saved configs count:', body.savedConfigs?.length || 0)
    console.log('Quote calculations present:', !!body.quoteCalculations)
    
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
    
    console.log('=== CALCULATED VALUES ===')
    console.log('Total Net:', totalNet, 'Type:', typeof totalNet)
    console.log('Total VAT:', totalVat, 'Type:', typeof totalVat)
    console.log('Total Gross:', totalGross, 'Type:', typeof totalGross)
    console.log('Discount Percent:', discountPercent, 'Type:', typeof discountPercent)
    console.log('Final Total:', finalTotal, 'Type:', typeof finalTotal)

    // Get currency_id and vat_id from worktop config fees
    console.log('=== FETCHING WORKTOP CONFIG FEES ===')
    const { data: worktopConfigFees, error: feesError } = await supabaseServer
      .from('worktop_config_fees')
      .select('currency_id, vat_id')
      .limit(1)
      .maybeSingle()

    if (feesError) {
      console.warn('Error fetching worktop config fees (non-critical):', feesError)
    } else {
      console.log('Worktop config fees:', worktopConfigFees)
      console.log('Currency ID:', worktopConfigFees?.currency_id)
      console.log('VAT ID:', worktopConfigFees?.vat_id)
    }

    // Create or update worktop quote
    // Convert to numbers, but preserve original values if conversion fails
    const quoteData: any = {
      customer_id: customerId,
      quote_number: quoteNumber,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      discount_percent: discountPercent || 0,
      final_total_after_discount: finalTotal,
      currency_id: worktopConfigFees?.currency_id || null,
      vat_id: worktopConfigFees?.vat_id || null,
      updated_at: new Date().toISOString()
    }
    
    // Don't set payment_status, order_number, or barcode for new quotes
    // - payment_status has a DEFAULT 'not_paid' in the database
    // - order_number and barcode should remain NULL (not explicitly set) to avoid UNIQUE constraint issues

    // Only set status for NEW quotes, not when updating
    if (!quoteId) {
      quoteData.status = body.status || 'draft'
      quoteData.created_by = user.id
      console.log('=== CREATING NEW QUOTE ===')
      console.log('Status:', quoteData.status)
      console.log('Created by:', quoteData.created_by)
    } else {
      console.log('=== UPDATING EXISTING QUOTE ===')
      console.log('Quote ID:', quoteId)
    }
    
    console.log('=== QUOTE DATA TO INSERT/UPDATE ===')
    console.log(JSON.stringify(quoteData, null, 2))

    let finalQuoteId = quoteId
    let finalQuoteNumber = quoteNumber

    if (quoteId) {
      // Update existing quote
      // First, check if barcode already exists
      const { data: existingQuote, error: fetchError } = await supabaseServer
        .from('worktop_quotes')
        .select('barcode')
        .eq('id', quoteId)
        .single()

      if (fetchError) {
        console.error('Error fetching existing quote:', fetchError)
        return NextResponse.json({ 
          error: 'Failed to fetch existing quote',
          details: fetchError.message
        }, { status: 500 })
      }

      // Generate barcode if it doesn't exist
      if (!existingQuote.barcode) {
        console.log('=== GENERATING BARCODE FOR EXISTING QUOTE ===')
        const { data: barcode, error: barcodeError } = await supabaseServer
          .rpc('generate_worktop_order_barcode')

        if (barcodeError || !barcode) {
          console.error('Error generating barcode:', barcodeError)
          // Continue without barcode - non-critical
        } else {
          quoteData.barcode = barcode
          console.log('Generated barcode for existing quote:', barcode)
        }
      } else {
        console.log('Quote already has barcode:', existingQuote.barcode)
      }

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
      // Create new quote - generate barcode automatically
      console.log('=== GENERATING BARCODE FOR NEW QUOTE ===')
      const { data: barcode, error: barcodeError } = await supabaseServer
        .rpc('generate_worktop_order_barcode')

      if (barcodeError || !barcode) {
        console.error('Error generating barcode:', barcodeError)
        // Continue without barcode - non-critical, but log warning
        console.warn('Proceeding without barcode for new quote')
      } else {
        quoteData.barcode = barcode
        console.log('Generated barcode for new quote:', barcode)
      }

      // Create new quote
      console.log('=== ATTEMPTING TO INSERT QUOTE ===')
      console.log('Quote data:', JSON.stringify(quoteData, null, 2))
      
      const { data: newQuote, error: quoteError } = await supabaseServer
        .from('worktop_quotes')
        .insert([quoteData])
        .select('id, quote_number')
        .single()

      if (quoteError) {
        console.error('=== DATABASE ERROR ===')
        console.error('Full error object:', JSON.stringify(quoteError, null, 2))
        console.error('Error message:', quoteError.message)
        console.error('Error code:', quoteError.code)
        console.error('Error hint:', quoteError.hint)
        console.error('Error details:', quoteError.details)
        console.error('Error name:', quoteError.name)
        console.error('Error stack:', quoteError.stack)
        console.error('Quote data that failed:', JSON.stringify(quoteData, null, 2))
        console.error('Customer ID:', customerId)
        console.error('Quote Number:', quoteNumber)
        console.error('=== END ERROR DETAILS ===')
        
        // Try to get more error details
        const errorDetails: any = {
          error: 'Failed to create worktop quote',
          details: quoteError.message || 'Unknown error',
          code: quoteError.code || 'UNKNOWN',
          hint: quoteError.hint || null
        }
        
        // Add all possible error properties
        try {
          errorDetails.fullError = JSON.stringify(quoteError, Object.getOwnPropertyNames(quoteError))
          errorDetails.errorObject = {
            message: quoteError.message,
            code: quoteError.code,
            details: quoteError.details,
            hint: quoteError.hint,
            name: (quoteError as any).name,
            stack: (quoteError as any).stack
          }
        } catch (e) {
          errorDetails.serializationError = String(e)
        }
        
        return NextResponse.json(errorDetails, { status: 500 })
      }
      
      console.log('=== QUOTE CREATED SUCCESSFULLY ===')
      console.log('New quote ID:', newQuote.id)
      console.log('New quote number:', newQuote.quote_number)

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
    console.error('=== UNEXPECTED ERROR IN WORKTOP QUOTES POST ===')
    console.error('Error type:', typeof error)
    console.error('Error:', error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    console.error('=== END UNEXPECTED ERROR ===')
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      },
      { status: 500 }
    )
  }
}
