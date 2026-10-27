import { NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import {
  detectImageMediaType,
  parsePanelImage
} from '@/lib/opti/parse-panel-image'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Nincs belépés.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'file kötelező (multipart mező: file)' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Max fájlméret 10 MB' },
        { status: 400 }
      )
    }

    const filename =
      typeof (file as File).name === 'string' ? (file as File).name : 'upload.jpg'
    const lower = filename.toLowerCase()
    if (lower.endsWith('.pdf')) {
      return NextResponse.json(
        {
          error:
            'PDF egyelőre nem támogatott. Készíts egy oldalas JPG/PNG fotót a listáról.'
        },
        { status: 415 }
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const mediaType = detectImageMediaType(file.type, filename)
    const result = await parsePanelImage({
      base64: buf.toString('base64'),
      mediaType
    })

    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Kép feldolgozás sikertelen'
    const status = /ANTHROPIC_API_KEY/i.test(msg) ? 503 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
