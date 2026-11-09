import { readFile } from 'fs/promises'
import { join } from 'path'

import JSZip from 'jszip'
import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

import { getTenantCompany } from '@/lib/company/queries'
import { launchPdfBrowser, renderHtmlToPdfBuffer } from '@/lib/jelenlet/pdf-browser'
import { computeSheetsForEmployees } from '@/lib/jelenlet/sheet-data'
import { parseSheetRequest } from '@/lib/jelenlet/sheet-request'
import {
  companyToSheetPdf,
  generateSheetHtml
} from '@/lib/jelenlet/sheet-template'

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

/** HTTP header-safe ASCII fájlnév rész (ékezet nélkül). */
function sanitizeFilenamePart(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'dolgozo'
  )
}

function contentDispositionAttachment(filenameAscii: string): string {
  const safe = filenameAscii.replace(/[^\x20-\x7E]/g, '_')
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (true) {
        const idx = next++
        if (idx >= items.length) return
        results[idx] = await fn(items[idx]!, idx)
      }
    })
  )
  return results
}

function fileResponse(buf: Uint8Array, contentType: string, filename: string) {
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': contentDispositionAttachment(filename),
      'Content-Length': String(buf.length)
    }
  })
}

export async function POST(request: Request) {
  const ctx = await parseSheetRequest(request)
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null
  try {
    const { body } = ctx
    const company = await getTenantCompany(ctx.supabase, ctx.tenantId)
    const [{ results }, tenantCompanyLogoBase64, turinovaLogoBase64] = await Promise.all([
      computeSheetsForEmployees(ctx.supabase, {
        tenantId: ctx.tenantId,
        employeeIds: body.employeeIds,
        year: body.year,
        month: body.month,
        rules: body.rules
      }),
      company?.logo_url
        ? fetch(company.logo_url)
            .then((res) =>
              res.ok
                ? res.arrayBuffer().then((b) => Buffer.from(b).toString('base64'))
                : ''
            )
            .catch(() => '')
        : Promise.resolve(''),
      readFile(join(process.cwd(), 'public', 'images', 'turinova-logo.png'))
        .then((b) => b.toString('base64'))
        .catch(() => '')
    ])

    if (results.length === 0) {
      return NextResponse.json({ error: 'Nem található a kijelölt dolgozó.' }, { status: 404 })
    }

    browser = await launchPdfBrowser()
    const concurrency = Math.min(3, Math.max(1, Number(process.env.PDF_BULK_CONCURRENCY || 2)))
    const pdfCompany = companyToSheetPdf(company)
    const monthAscii = MONTH_ASCII[body.month - 1] ?? String(body.month)
    const kindPart = body.rules.base === 'official' ? 'Hivatalos' : 'Belso'

    const files = await mapWithConcurrency(results, concurrency, async ({ employee, result }) => {
      const html = generateSheetHtml({
        company: pdfCompany,
        employee,
        year: body.year,
        month: body.month,
        result,
        rules: body.rules,
        presetName: body.presetName,
        tenantCompanyLogoBase64,
        turinovaLogoBase64
      })
      const buf = await renderHtmlToPdfBuffer(browser, html)
      return {
        filename: `Jelenleti-iv-${kindPart}-${body.year}-${monthAscii}-${sanitizeFilenamePart(employee.name)}.pdf`,
        buf
      }
    })

    if (files.length === 1) {
      return fileResponse(new Uint8Array(files[0]!.buf), 'application/pdf', files[0]!.filename)
    }

    if (body.output === 'merged') {
      const merged = await PDFDocument.create()
      for (const f of files) {
        const doc = await PDFDocument.load(f.buf)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        for (const p of pages) merged.addPage(p)
      }
      const bytes = await merged.save()
      return fileResponse(
        bytes,
        'application/pdf',
        `Jelenleti-ivek-${kindPart}-${body.year}-${monthAscii}.pdf`
      )
    }

    const zip = new JSZip()
    for (const f of files) zip.file(f.filename, f.buf)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    return fileResponse(
      new Uint8Array(zipBuffer),
      'application/zip',
      `Jelenleti-ivek-${kindPart}-${body.year}-${monthAscii}.zip`
    )
  } catch (error) {
    console.error('jelenlet iv pdf', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF generálás sikertelen.' },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
