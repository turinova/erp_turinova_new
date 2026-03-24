import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'

type Payload = {
  productIds?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as Payload
    const productIds = Array.isArray(body?.productIds) ? body.productIds.filter(Boolean) : []

    if (productIds.length === 0) {
      return NextResponse.json({ error: 'Nincs szinkronizálható termék.' }, { status: 400 })
    }

    const response = await fetch(new URL('/api/products/bulk-sync-to-shoprenter', request.nextUrl.origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ productIds })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ error: data?.error || 'Webshop szinkron indítása sikertelen' }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'Webshop szinkron elindult a kiválasztott termékekre.',
      progressKey: data?.progressKey || null,
      total: productIds.length
    })
  } catch (error: any) {
    console.error('Product sync-to-webshop route error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
