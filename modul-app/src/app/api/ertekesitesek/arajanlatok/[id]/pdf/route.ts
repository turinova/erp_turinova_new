import { NextRequest, NextResponse } from 'next/server'

import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import {
  launchPdfBrowser,
  renderHtmlToPdfBuffer
} from '@/lib/jelenlet/pdf-browser'
import { loadPdfLogos } from '@/lib/pdf/load-pdf-logos'
import { getSalesQuote } from '@/lib/sales-quotes/queries'
import { generateSalesQuotePdfHtml } from '@/lib/sales-quotes/pdf-template'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Érvénytelen azonosító' }, { status: 400 })
    }

    const user = await getSessionUser()
    if (!user?.tenantId || user.isDevSession || !user.hasMembership) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    const [detail, company] = await Promise.all([
      getSalesQuote(supabase, user.tenantId, id),
      getTenantCompany(supabase, user.tenantId)
    ])

    if (!detail) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }
    if (!company) {
      return NextResponse.json(
        { error: 'Cégadatok nem találhatók' },
        { status: 500 }
      )
    }

    const logos = await loadPdfLogos(company.logo_url)

    const html = generateSalesQuotePdfHtml(
      detail,
      {
        name: company.name || 'Cég',
        taxNumber: company.tax_number,
        postalCode: company.postal_code,
        city: company.city,
        address: company.address,
        email: company.email,
        phone: company.phone_number
      },
      logos
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null

    try {
      browser = await launchPdfBrowser()
      // Same Puppeteer margins as lapszabászat quote PDF
      const pdfBuffer = await renderHtmlToPdfBuffer(browser, html, {
        margin: { top: '8mm', right: '4mm', bottom: '8mm', left: '4mm' }
      })
      await browser.close()
      browser = null

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Arajanlat-${detail.quote_number}.pdf"`,
          'Content-Length': String(pdfBuffer.length)
        }
      })
    } finally {
      if (browser) await browser.close().catch(() => undefined)
    }
  } catch (error: unknown) {
    console.error('sales quote PDF', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'PDF generálási hiba'
      },
      { status: 500 }
    )
  }
}
