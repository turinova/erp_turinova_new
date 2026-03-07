import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

/**
 * POST /api/products
 * Create a new product in ERP (not yet synced to ShopRenter)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      connection_id,
      sku,
      name,
      model_number,
      gtin,
      brand,
      manufacturer_id,
      parent_product_id,
      product_class_shoprenter_id,
      category_ids,
      product_attributes,
      cost,
      multiplier,
      vat_id,
      short_description,
      description,
      meta_title,
      meta_description,
      url_slug
    } = body

    // Validation - Only connection_id, sku, name, and cost are required
    if (!connection_id || !sku || !name || !cost) {
      return NextResponse.json(
        { error: 'Kapcsolat, SKU, név és beszerzési ár kötelező mezők' },
        { status: 400 }
      )
    }

    // Categories and vat_id are optional
    // if (!category_ids || category_ids.length === 0) {
    //   return NextResponse.json(
    //     { error: 'Legalább egy kategória kötelező' },
    //     { status: 400 }
    //   )
    // }

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate connection exists and is active
    const connection = await getConnectionById(connection_id)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json(
        { error: 'Kapcsolat nem található vagy érvénytelen típus' },
        { status: 404 }
      )
    }

    if (!connection.is_active) {
      return NextResponse.json(
        { error: 'A kapcsolat inaktív' },
        { status: 400 }
      )
    }

    // Validate SKU uniqueness
    const { data: existingProduct, error: skuCheckError } = await supabase
      .from('shoprenter_products')
      .select('id, sku')
      .eq('connection_id', connection_id)
      .eq('sku', sku.trim())
      .is('deleted_at', null)
      .maybeSingle()

    if (skuCheckError) {
      console.error('Error checking SKU:', skuCheckError)
      return NextResponse.json(
        { error: 'Hiba a SKU ellenőrzésekor' },
        { status: 500 }
      )
    }

    if (existingProduct) {
      return NextResponse.json(
        { error: `A SKU "${sku}" már létezik ezen a kapcsolaton` },
        { status: 400 }
      )
    }

    // Validate parent product if provided
    if (parent_product_id && parent_product_id.trim() !== '') {
      const { data: parentProduct, error: parentError } = await supabase
        .from('shoprenter_products')
        .select('id, connection_id')
        .eq('id', parent_product_id)
        .eq('connection_id', connection_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (parentError) {
        console.error('Error validating parent product:', parentError)
        return NextResponse.json(
          { error: 'Hiba a szülő termék ellenőrzésekor' },
          { status: 500 }
        )
      }

      if (!parentProduct) {
        return NextResponse.json(
          { error: 'Szülő termék nem található vagy nem tartozik ehhez a kapcsolathoz' },
          { status: 400 }
        )
      }
    }

    // Validate categories exist and belong to connection (only if categories are provided)
    if (category_ids && category_ids.length > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from('shoprenter_categories')
        .select('id')
        .eq('connection_id', connection_id)
        .in('id', category_ids)
        .is('deleted_at', null)

      if (categoriesError) {
        console.error('Error validating categories:', categoriesError)
        return NextResponse.json(
          { error: 'Hiba a kategóriák ellenőrzésekor' },
          { status: 500 }
        )
      }

      if (!categories || categories.length !== category_ids.length) {
        return NextResponse.json(
          { error: 'Egy vagy több kategória nem található vagy nem tartozik ehhez a kapcsolathoz' },
          { status: 400 }
        )
      }
    }

    // Calculate net price
    const netPrice = parseFloat(cost) * (parseFloat(multiplier) || 1.0)

    // Get VAT rate to calculate gross price (optional)
    let grossPrice = netPrice
    if (vat_id) {
      const { data: vatRate, error: vatError } = await supabase
        .from('vat')
        .select('kulcs')
        .eq('id', vat_id)
        .single()

      if (vatError || !vatRate) {
        return NextResponse.json(
          { error: 'ÁFA kulcs nem található' },
          { status: 400 }
        )
      }

      grossPrice = netPrice * (1 + vatRate.kulcs / 100)
    }

    // Generate unique placeholder shoprenter_id for pending products
    // Format: pending-{timestamp}-{random}
    const placeholderShopRenterId = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

    // Validate product class if provided
    if (product_class_shoprenter_id) {
      const { data: productClass, error: productClassError } = await supabase
        .from('shoprenter_product_classes')
        .select('id')
        .eq('connection_id', connection_id)
        .eq('shoprenter_id', product_class_shoprenter_id)
        .is('deleted_at', null)
        .single()

      if (productClassError || !productClass) {
        return NextResponse.json(
          { error: 'A termék típus nem található vagy nem tartozik ehhez a kapcsolathoz' },
          { status: 400 }
        )
      }
    }

    // Create product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .insert({
        connection_id,
        shoprenter_id: placeholderShopRenterId, // Placeholder until synced
        sku: sku.trim(),
        model_number: model_number?.trim() || null,
        gtin: gtin?.trim() || null,
        manufacturer_id: manufacturer_id || null,
        name: name.trim(),
        status: 1, // Active
        sync_status: 'pending', // Not yet synced to ShopRenter
        parent_product_id: (parent_product_id && String(parent_product_id).trim() !== '') ? String(parent_product_id) : null,
        product_class_shoprenter_id: product_class_shoprenter_id || null,
        product_attributes: product_attributes || null,
        cost: parseFloat(cost),
        price: netPrice,
        multiplier: parseFloat(multiplier) || 1.0,
        multiplier_lock: false,
        vat_id,
        gross_price: grossPrice,
        url_slug: url_slug?.trim() || null
      })
      .select()
      .single()

    if (productError || !product) {
      console.error('Error creating product:', productError)
      return NextResponse.json(
        { error: `Hiba a termék létrehozásakor: ${productError?.message || 'Termék nem lett létrehozva'}` },
        { status: 500 }
      )
    }

    // Create product description
    const { data: descriptionData, error: descriptionError } = await supabase
      .from('shoprenter_product_descriptions')
      .insert({
        product_id: product.id,
        language_code: 'hu',
        name: name.trim(),
        short_description: short_description?.trim() || null,
        description: description?.trim() || null,
        meta_title: meta_title?.trim() || null,
        meta_description: meta_description?.trim() || null
      })
      .select()
      .single()

    if (descriptionError) {
      console.error('Error creating product description:', descriptionError)
      // Try to delete the product if description creation fails
      await supabase
        .from('shoprenter_products')
        .delete()
        .eq('id', product.id)
      
      return NextResponse.json(
        { error: `Hiba a termék leírás létrehozásakor: ${descriptionError.message}` },
        { status: 500 }
      )
    }

    // Create product-category relations (optional - categories are not required)
    if (category_ids && category_ids.length > 0) {
      // Fetch category shoprenter_ids
      const { data: categories, error: categoriesFetchError } = await supabase
        .from('shoprenter_categories')
        .select('id, shoprenter_id')
        .in('id', category_ids)
        .eq('connection_id', connection_id)

      if (categoriesFetchError) {
        console.error('Error fetching categories for relations:', categoriesFetchError)
      } else {
        // For pending products, we'll use placeholder shoprenter_ids for relations
        // These will be updated when the product is synced to ShopRenter
        const relations = category_ids.map((categoryId: string) => {
          const category = categories?.find(c => c.id === categoryId)
          return {
            connection_id,
            shoprenter_id: `pending-relation-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            product_id: product.id,
            category_id: categoryId,
            product_shoprenter_id: placeholderShopRenterId,
            category_shoprenter_id: category?.shoprenter_id || `pending-category-${categoryId}`
          }
        })

        const { error: relationsError } = await supabase
          .from('shoprenter_product_category_relations')
          .insert(relations)

        if (relationsError) {
          console.error('Error creating category relations:', relationsError)
          // Non-fatal, continue
        }
      }
    }

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        description: descriptionData
      },
      message: 'Termék sikeresen létrehozva! Szinkronizálhatja a webshopba a termék szerkesztése oldalon.'
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
