import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search') || ''
    const partnerId = searchParams.get('partner_id') || ''

    if (!searchTerm || !searchTerm.trim() || !partnerId) {
      // No search term or partner_id - return empty
      return NextResponse.json([])
    }

    const trimmedSearch = searchTerm.trim()
    const resultLimit = 50 // Limit results for performance

    // Search accessories by name and SKU, filtered by partner_id
    const [accessoryNameResult, accessorySkuResult] = await Promise.all([
      // Search accessories by name
      supabaseServer
        .from('accessories')
        .select(`
          id,
          name,
          sku,
          net_price,
          vat_id,
          currency_id,
          units_id,
          partners_id,
          vat (
            id,
            kulcs
          ),
          currencies (
            id,
            name
          ),
          units (
            id,
            shortform
          )
        `)
        .eq('partners_id', partnerId)
        .ilike('name', `%${trimmedSearch}%`)
        .is('deleted_at', null)
        .limit(resultLimit),
      // Search accessories by SKU
      supabaseServer
        .from('accessories')
        .select(`
          id,
          name,
          sku,
          net_price,
          vat_id,
          currency_id,
          units_id,
          partners_id,
          vat (
            id,
            kulcs
          ),
          currencies (
            id,
            name
          ),
          units (
            id,
            shortform
          )
        `)
        .eq('partners_id', partnerId)
        .ilike('sku', `%${trimmedSearch}%`)
        .is('deleted_at', null)
        .limit(resultLimit)
    ])

    // Check for errors
    if (accessoryNameResult.error) {
      console.error('Error searching accessories by name:', accessoryNameResult.error)
    }
    if (accessorySkuResult.error) {
      console.error('Error searching accessories by SKU:', accessorySkuResult.error)
    }

    // Merge accessory results and deduplicate
    const accessoryMap = new Map<string, any>()
    ;[...(accessoryNameResult.data || []), ...(accessorySkuResult.data || [])].forEach((acc: any) => {
      if (!acc.deleted_at && acc.vat_id && acc.currency_id && acc.units_id) {
        accessoryMap.set(acc.id, acc)
      }
    })
    const uniqueAccessories = Array.from(accessoryMap.values())

    // Transform to final format
    const accessories = uniqueAccessories.map((acc) => {
      const vatPercent = acc.vat?.kulcs || 0
      const net_price = acc.net_price || 0
      const gross_price = net_price + ((net_price * vatPercent) / 100)

      return {
        id: acc.id,
        name: acc.name,
        sku: acc.sku || '',
        net_price: net_price,
        gross_price: gross_price,
        vat_id: acc.vat_id,
        currency_id: acc.currency_id,
        units_id: acc.units_id,
        partners_id: acc.partners_id,
        currency_name: acc.currencies?.name || 'HUF',
        unit_shortform: acc.units?.shortform || 'db',
        vat_percent: vatPercent
      }
    })

    return NextResponse.json(accessories)
  } catch (error) {
    console.error('Error in shipments accessories GET:', error)
    return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 })
  }
}

