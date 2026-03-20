import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminSupabase } from '@/lib/tenant-supabase'
import { fetchLiveOffersBySku } from '@/lib/shoprenter-live-offers'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function toGross(netPrice: number, vatRate = 27): number {
  return Math.round(netPrice * (1 + vatRate / 100))
}

export async function GET(request: NextRequest) {
  try {
    const configuredToken = process.env.INTERNAL_SCHEMA_DRIFT_TOKEN
    const providedToken = request.headers.get('x-internal-token')
    if (!configuredToken || providedToken !== configuredToken) {
      return unauthorized()
    }

    const tenantSlug = request.nextUrl.searchParams.get('tenant')
    if (!tenantSlug) {
      return NextResponse.json({ error: 'Missing tenant query parameter' }, { status: 400 })
    }

    const limit = Math.min(
      Number.parseInt(request.nextUrl.searchParams.get('limit') || '30', 10) || 30,
      100
    )
    const maxDriftPercent = Number.parseFloat(request.nextUrl.searchParams.get('thresholdPct') || '3') || 3

    const adminSupabase = await getAdminSupabase()
    const { data: tenant } = await adminSupabase
      .from('tenants')
      .select('supabase_url, supabase_anon_key, slug')
      .eq('slug', tenantSlug)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const tenantSupabase = createClient(tenant.supabase_url, tenant.supabase_anon_key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: products } = await tenantSupabase
      .from('shoprenter_products')
      .select('id, sku, price, status, product_url, connection_id, updated_at')
      .is('deleted_at', null)
      .not('sku', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (!products || products.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, mismatches: [] })
    }

    const connectionIds = Array.from(new Set(products.map((p: any) => p.connection_id).filter(Boolean)))
    const { data: connections } = await tenantSupabase
      .from('webshop_connections')
      .select('id, api_url, username, password')
      .in('id', connectionIds)
    const connectionMap = new Map((connections || []).map((c: any) => [c.id, c]))

    const mismatches: Array<Record<string, unknown>> = []
    for (const product of products) {
      const connection = connectionMap.get(product.connection_id)
      if (!connection) continue

      const { data: children } = await tenantSupabase
        .from('shoprenter_products')
        .select('sku')
        .eq('parent_product_id', product.id)
        .neq('id', product.id)
        .is('deleted_at', null)
        .limit(50)

      const live = await fetchLiveOffersBySku({
        tenantKey: tenantSlug,
        rootSku: product.sku,
        relatedSkus: (children || []).map((c: any) => c.sku).filter(Boolean),
        connection: {
          api_url: connection.api_url,
          username: connection.username,
          password: connection.password
        }
      })

      const liveOffer = live?.[product.sku]
      if (!liveOffer || product.price === null || product.price === undefined) continue

      const schemaPrice = toGross(product.price)
      const schemaAvailability = product.status === 1 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      const priceDiffPct = Math.abs((liveOffer.priceGross - schemaPrice) / Math.max(1, liveOffer.priceGross)) * 100
      const stockMismatch = schemaAvailability !== liveOffer.availability

      if (priceDiffPct >= maxDriftPercent || stockMismatch) {
        mismatches.push({
          sku: product.sku,
          schemaPrice,
          livePrice: liveOffer.priceGross,
          priceDiffPct: Number(priceDiffPct.toFixed(2)),
          schemaAvailability,
          liveAvailability: liveOffer.availability,
          stockMismatch
        })
      }
    }

    const mismatchRate = (mismatches.length / products.length) * 100
    const shouldAlert = mismatchRate >= 10 || mismatches.length >= 5

    return NextResponse.json({
      ok: true,
      tenant: tenantSlug,
      checked: products.length,
      mismatchCount: mismatches.length,
      mismatchRatePct: Number(mismatchRate.toFixed(2)),
      shouldAlert,
      thresholdPct: maxDriftPercent,
      mismatches
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Schema drift check failed', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
