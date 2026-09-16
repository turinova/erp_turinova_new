import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { applyAccessoriesImport } from '@/lib/accessories/import-plan'
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
    const result = await applyAccessoriesImport(
      ctx.supabase,
      ctx.user.tenantId!,
      buffer
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    revalidatePath('/torzsadatok/alapanyagok/termekek')

    return NextResponse.json({ results: result.results })
  } catch (err) {
    console.error('accessories import', err)
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Az import sikertelen.'
      },
      { status: 500 }
    )
  }
}
