import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabase-server'

// GET /api/shoporder/search - Search materials and linear materials for shop order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')
    
    if (!search || search.length < 2) {
      return NextResponse.json({ materials: [], linearMaterials: [] })
    }

    console.log(`[SHOP ORDER] Searching for: "${search}"`)
    const startTime = performance.now()

    // Search materials
    const { data: materialsData, error: materialsError } = await supabaseServer
      .from('materials')
      .select(`
        id,
        name,
        length_mm,
        width_mm,
        thickness_mm,
        base_price,
        multiplier,
        price_per_sqm,
        partners_id,
        units_id,
        currency_id,
        vat_id,
        brands:brand_id(name),
        partners:partners_id(name),
        units:units_id(name, shortform),
        currencies:currency_id(name),
        vat:vat_id(name, kulcs)
      `)
      .is('deleted_at', null)
      .eq('active', true)
      .ilike('name', `%${search}%`)
      .limit(20)

    if (materialsError) {
      console.error('Error searching materials:', materialsError)
      return NextResponse.json({ error: 'Failed to search materials' }, { status: 500 })
    }

    // Search linear materials
    const { data: linearMaterialsData, error: linearMaterialsError } = await supabaseServer
      .from('linear_materials')
      .select(`
        id,
        name,
        width,
        length,
        thickness,
        type,
        base_price,
        multiplier,
        price_per_m,
        partners_id,
        units_id,
        currency_id,
        vat_id,
        brands:brand_id(name),
        partners:partners_id(name),
        units:units_id(name, shortform),
        currencies:currency_id(name),
        vat:vat_id(name, kulcs)
      `)
      .is('deleted_at', null)
      .eq('active', true)
      .ilike('name', `%${search}%`)
      .limit(20)

    if (linearMaterialsError) {
      console.error('Error searching linear materials:', linearMaterialsError)
      return NextResponse.json({ error: 'Failed to search linear materials' }, { status: 500 })
    }

    // Search accessories - split into two queries to avoid .or() syntax issues with special characters
    const [accessoriesByName, accessoriesBySku] = await Promise.all([
      supabaseServer
        .from('accessories')
        .select(`
          id,
          name,
          sku,
          base_price,
          multiplier,
          net_price,
          partners_id,
          units_id,
          currency_id,
          vat_id,
          partners:partners_id(name),
          units:units_id(name, shortform),
          currencies:currency_id(name),
          vat:vat_id(name, kulcs)
        `)
        .is('deleted_at', null)
        .ilike('name', `%${search}%`)
        .limit(10),
      
      supabaseServer
        .from('accessories')
        .select(`
          id,
          name,
          sku,
          base_price,
          multiplier,
          net_price,
          partners_id,
          units_id,
          currency_id,
          vat_id,
          partners:partners_id(name),
          units:units_id(name, shortform),
          currencies:currency_id(name),
          vat:vat_id(name, kulcs)
        `)
        .is('deleted_at', null)
        .ilike('sku', `%${search}%`)
        .limit(10)
    ])

    const accessoriesError = accessoriesByName.error || accessoriesBySku.error
    
    // Merge and deduplicate results by ID
    const accessoriesMap = new Map()
    accessoriesByName.data?.forEach(acc => accessoriesMap.set(acc.id, acc))
    accessoriesBySku.data?.forEach(acc => accessoriesMap.set(acc.id, acc))
    const accessoriesData = Array.from(accessoriesMap.values()).slice(0, 20)

    if (accessoriesError) {
      console.error('Error searching accessories:', accessoriesError)
      console.error('Accessories error details:', JSON.stringify(accessoriesError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to search accessories',
        details: accessoriesError.message,
        code: accessoriesError.code
      }, { status: 500 })
    }

    // Get machine codes for materials
    const materialIds = materialsData?.map(m => m.id) || []
    const { data: materialMachineCodes } = await supabaseServer
      .from('machine_material_map')
      .select('material_id, machine_code')
      .in('material_id', materialIds)
      .eq('machine_type', 'Korpus')

    // Get machine codes for linear materials
    const linearMaterialIds = linearMaterialsData?.map(lm => lm.id) || []
    const { data: linearMaterialMachineCodes } = await supabaseServer
      .from('machine_linear_material_map')
      .select('linear_material_id, machine_code')
      .in('linear_material_id', linearMaterialIds)
      .eq('machine_type', 'Korpus')

    // Create machine code maps
    const materialMachineCodeMap = new Map(
      materialMachineCodes?.map(mc => [mc.material_id, mc.machine_code]) || []
    )
    const linearMaterialMachineCodeMap = new Map(
      linearMaterialMachineCodes?.map(mc => [mc.linear_material_id, mc.machine_code]) || []
    )

    // Transform materials data
    const materials = materialsData?.map(material => {
      // Calculate whole board price (base_price is per m²)
      const boardAreaM2 = (material.length_mm * material.width_mm) / 1_000_000
      const wholeBoardPrice = Math.round((material.base_price || 0) * boardAreaM2)
      
      return {
        id: material.id,
        name: material.name,
        sku: materialMachineCodeMap.get(material.id) || '',
        type: 'Bútorlap',
        base_price: wholeBoardPrice, // Whole board price, not per m²
        multiplier: material.multiplier || 1.38,
        net_price: material.price_per_sqm || 0,
        gross_price: Math.round((material.price_per_sqm || 0) * (1 + (material.vat?.kulcs || 0) / 100)),
        partners_id: material.partners_id,
        units_id: material.units_id,
        currency_id: material.currency_id,
        vat_id: material.vat_id,
        partner_name: material.partners?.name || '',
        unit_name: material.units?.name || '',
        unit_shortform: material.units?.shortform || '',
        currency_name: material.currencies?.name || '',
        vat_percent: material.vat?.kulcs || 0,
        vat_amount: Math.round((material.price_per_sqm || 0) * (material.vat?.kulcs || 0) / 100),
        brand_name: material.brands?.name || '',
        dimensions: `${material.length_mm}x${material.width_mm}x${material.thickness_mm}mm`,
        source: 'materials'
      }
    }) || []

    // Transform linear materials data
    const linearMaterials = linearMaterialsData?.map(linearMaterial => {
      // Calculate whole piece price (base_price is per meter, length is in mm)
      const lengthInMeters = linearMaterial.length / 1000
      const wholePiecePrice = Math.round((linearMaterial.base_price || 0) * lengthInMeters)
      
      return {
        id: linearMaterial.id,
        name: linearMaterial.name,
        sku: linearMaterialMachineCodeMap.get(linearMaterial.id) || '',
        type: linearMaterial.type || 'Lineáris anyag',
        base_price: wholePiecePrice, // Whole piece price, not per meter
        multiplier: linearMaterial.multiplier || 1.38,
        net_price: linearMaterial.price_per_m || 0,
        gross_price: Math.round((linearMaterial.price_per_m || 0) * (1 + (linearMaterial.vat?.kulcs || 0) / 100)),
        partners_id: linearMaterial.partners_id,
        units_id: linearMaterial.units_id,
        currency_id: linearMaterial.currency_id,
        vat_id: linearMaterial.vat_id,
        partner_name: linearMaterial.partners?.name || '',
        unit_name: linearMaterial.units?.name || '',
        unit_shortform: linearMaterial.units?.shortform || '',
        currency_name: linearMaterial.currencies?.name || '',
        vat_percent: linearMaterial.vat?.kulcs || 0,
        vat_amount: Math.round((linearMaterial.price_per_m || 0) * (linearMaterial.vat?.kulcs || 0) / 100),
        brand_name: linearMaterial.brands?.name || '',
        dimensions: `${linearMaterial.width}x${linearMaterial.length}x${linearMaterial.thickness}mm`,
        source: 'linear_materials'
      }
    }) || []

    // Transform accessories data
    const accessories = accessoriesData?.map(accessory => ({
      id: accessory.id,
      name: accessory.name,
      sku: accessory.sku,
      type: 'Termék',
      base_price: accessory.base_price || 0,
      multiplier: accessory.multiplier || 1.38,
      net_price: accessory.net_price || 0,
      gross_price: Math.round((accessory.net_price || 0) * (1 + (accessory.vat?.kulcs || 0) / 100)),
      partners_id: accessory.partners_id,
      units_id: accessory.units_id,
      currency_id: accessory.currency_id,
      vat_id: accessory.vat_id,
      partner_name: accessory.partners?.name || '',
      unit_name: accessory.units?.name || '',
      unit_shortform: accessory.units?.shortform || '',
      currency_name: accessory.currencies?.name || '',
      vat_percent: accessory.vat?.kulcs || 0,
      vat_amount: Math.round((accessory.net_price || 0) * (accessory.vat?.kulcs || 0) / 100),
      brand_name: '',
      dimensions: '',
      source: 'accessories'
    })) || []

    const totalTime = performance.now() - startTime
    console.log(`[SHOP ORDER] Search completed in ${totalTime.toFixed(2)}ms - Found ${materials.length} materials, ${linearMaterials.length} linear materials, ${accessories.length} accessories`)

    return NextResponse.json({
      materials,
      linearMaterials,
      accessories,
      totalCount: materials.length + linearMaterials.length + accessories.length
    })

  } catch (error) {
    console.error('Error in shop order search:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
