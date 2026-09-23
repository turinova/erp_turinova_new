import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { getInvoicePdfBuffer } from '@/lib/invoicing/issue-sale'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Nincs adatbázis' }, { status: 500 })
  }

  const result = await getInvoicePdfBuffer(supabase, user.tenantId, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  const safeName = result.filename.replace(/[^\w.-]+/g, '_')
  return new NextResponse(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, max-age=300'
    }
  })
}
