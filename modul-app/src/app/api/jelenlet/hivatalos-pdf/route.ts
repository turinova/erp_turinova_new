import { readFile } from 'fs/promises'
import { join } from 'path'

import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import {
  buildOfficialAttendancePdfInput
} from '@/lib/jelenlet/pdf-data'
import {
  launchPdfBrowser,
  renderHtmlToPdfBuffer
} from '@/lib/jelenlet/pdf-browser'
import generateOfficialAttendancePdfHtml from '@/lib/jelenlet/pdf-template'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const MONTH_ASCII = [
  'Januar',
  'Februar',
  'Marcius',
  'Aprilis',
  'Majus',
  'Junius',
  'Julius',
  'Augusztus',
  'Szeptember',
  'Oktober',
  'November',
  'December'
]

function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '')
}

/** HTTP header-safe ASCII fájlnév rész (ékezet nélkül). */
function sanitizeFilenamePart(input: string): string {
  return (
    stripDiacritics(input)
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'dolgozo'
  )
}

/** Content-Disposition: filename= csak Latin-1/ASCII lehet. */
function contentDispositionAttachment(filenameAscii: string): string {
  const safe = filenameAscii.replace(/[^\x20-\x7E]/g, '_')
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

function assertValidMonthYear(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Érvénytelen év')
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Érvénytelen hónap')
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.max(1, concurrency) },
    async () => {
      while (true) {
        const idx = next++
        if (idx >= items.length) return
        results[idx] = await fn(items[idx]!)
      }
    }
  )
  await Promise.all(workers)
  return results
}

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null
  try {
    const user = await getSessionUser()
    if (!user?.tenantId || user.isDevSession) {
      return NextResponse.json(
        { error: 'Nincs bejelentkezett tenant.' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as {
      employeeIds?: string[]
      year?: number
      month?: number
    }

    const employeeIds = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter(Boolean)
      : []
    const year = Number(body.year)
    const month = Number(body.month)

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { error: 'Nincs kiválasztott dolgozó.' },
        { status: 400 }
      )
    }
    if (employeeIds.length > 100) {
      return NextResponse.json(
        { error: 'Túl sok dolgozó (max. 100).' },
        { status: 400 }
      )
    }

    assertValidMonthYear(year, month)

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    const company = await getTenantCompany(supabase, user.tenantId)

    const [tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
      company?.logo_url
        ? fetch(company.logo_url)
            .then((res) => {
              if (!res.ok) return ''
              return res
                .arrayBuffer()
                .then((buf) => Buffer.from(buf).toString('base64'))
            })
            .catch(() => '')
        : Promise.resolve(''),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then((buf) => buf.toString('base64'))
        .catch(() => '')
    ])

    browser = await launchPdfBrowser()
    const monthAscii = MONTH_ASCII[month - 1] ?? String(month)
    const concurrency = Math.min(
      3,
      Math.max(1, Number(process.env.PDF_BULK_CONCURRENCY || 2))
    )

    const zip = new JSZip()
    const manifest: {
      success: Array<{ employeeId: string; filename: string }>
      errors: Array<{ employeeId: string; error: string }>
    } = { success: [], errors: [] }

    await mapWithConcurrency(employeeIds, concurrency, async (employeeId) => {
      try {
        const payload = await buildOfficialAttendancePdfInput(supabase, {
          tenantId: user.tenantId!,
          employeeId,
          year,
          month,
          company,
          tenantCompanyLogoBase64,
          turinovaLogoBase64
        })
        if (!payload) {
          manifest.errors.push({
            employeeId,
            error: 'Dolgozó nem található.'
          })
          return
        }

        const html = generateOfficialAttendancePdfHtml(payload)
        const pdfBuffer = await renderHtmlToPdfBuffer(browser, html)
        const filename = `Jelenleti-iv-${year}-${monthAscii}-${sanitizeFilenamePart(payload.employee.name)}.pdf`
        zip.file(filename, pdfBuffer)
        manifest.success.push({ employeeId, filename })
      } catch (e) {
        manifest.errors.push({
          employeeId,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    })

    if (manifest.success.length === 0) {
      return NextResponse.json(
        {
          error: 'Nem sikerült PDF-et készíteni.',
          details: manifest.errors
        },
        { status: 500 }
      )
    }

    // Egy dolgozó → közvetlen PDF; több → ZIP
    if (manifest.success.length === 1 && employeeIds.length === 1) {
      const only = manifest.success[0]!
      const file = zip.file(only.filename)
      const buf = file ? await file.async('nodebuffer') : null
      if (!buf) {
        return NextResponse.json(
          { error: 'PDF buffer hiányzik.' },
          { status: 500 }
        )
      }
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': contentDispositionAttachment(only.filename),
          'Content-Length': String(buf.length)
        }
      })
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    const zipFilename = `Hivatalos-jelenleti-ivek-${year}-${monthAscii}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDispositionAttachment(zipFilename),
        'Content-Length': String(zipBuffer.length)
      }
    })
  } catch (error) {
    console.error('jelenlet hivatalos pdf', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Hiba történt a PDF generálása során.'
      },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
