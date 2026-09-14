import { NextRequest, NextResponse } from 'next/server'

import { previewEdgeMaterialsImport } from '@/lib/edge-materials/import-plan'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireWritableTenant()
    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.message }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Hiányzik az Excel fájl.' },
        { status: 400 }
      )
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Csak .xlsx fájl tölthető fel.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await previewEdgeMaterialsImport(
      ctx.supabase,
      ctx.user.tenantId!,
      buffer
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result.preview)
  } catch (err) {
    console.error('edge-materials import preview', err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Az előnézet betöltése sikertelen.'
      },
      { status: 500 }
    )
  }
}
