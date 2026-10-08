import { NextRequest, NextResponse } from 'next/server'

import { getPartnerSession } from '@/lib/auth/partner-session'
import { getSessionUser } from '@/lib/auth/session'
import { getTenantCompany } from '@/lib/company/queries'
import { launchPdfBrowser } from '@/lib/jelenlet/pdf-browser'
import { loadPdfLogos } from '@/lib/pdf/load-pdf-logos'
import {
  getQuoteForPdf,
  tenantCompanyToPdf
} from '@/lib/quotes/pdf-data'
import generateQuotePdfHtml from '@/lib/quotes/pdf-template'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || id === 'new') {
      return NextResponse.json(
        { error: 'Érvénytelen árajánlat azonosító' },
        { status: 400 }
      )
    }

    const staffUser = await getSessionUser()
    const partnerSession = await getPartnerSession()

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Az adatbázis kapcsolat nem elérhető.' },
        { status: 500 }
      )
    }

    let tenantId: string | null = null

    if (staffUser?.tenantId && staffUser.hasMembership && !staffUser.isDevSession) {
      tenantId = staffUser.tenantId
    } else if (partnerSession) {
      const { data: owned } = await supabase
        .from('quotes')
        .select('tenant_id')
        .eq('id', id)
        .eq('partner_profile_id', partnerSession.id)
        .eq('source', 'portal')
        .is('deleted_at', null)
        .maybeSingle()

      if (!owned) {
        return NextResponse.json(
          { error: 'Árajánlat nem található' },
          { status: 404 }
        )
      }
      tenantId = owned.tenant_id
    } else if (staffUser?.isDevSession) {
      return NextResponse.json(
        { error: 'Dev bypass módban nincs adatbázis.' },
        { status: 400 }
      )
    } else {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 })
    }

    const [quoteData, tenantCompany] = await Promise.all([
      getQuoteForPdf(supabase, tenantId, id),
      getTenantCompany(supabase, tenantId)
    ])

    if (!quoteData) {
      return NextResponse.json(
        { error: 'Árajánlat nem található' },
        { status: 404 }
      )
    }

    if (!tenantCompany) {
      return NextResponse.json(
        { error: 'Cégadatok nem találhatók' },
        { status: 500 }
      )
    }

    // Végösszeg = lapszabászat + termékek + egyéb díjak / jóváírások
    const feesNet = Math.round(quoteData.totals.fees_total_net ?? 0)
    const feesVat = Math.round(quoteData.totals.fees_total_vat ?? 0)
    const accessoriesNet = Math.round(
      quoteData.totals.accessories_total_net ?? 0
    )
    const accessoriesVat = Math.round(
      quoteData.totals.accessories_total_vat ?? 0
    )
    const finalGross = Math.round(
      quoteData.totals.final_total_after_discount ??
        quoteData.totals.total_gross
    )
    const summary = {
      totalNetBeforeDiscount:
        Math.round(quoteData.totals.total_net) + feesNet + accessoriesNet,
      totalVatBeforeDiscount:
        Math.round(quoteData.totals.total_vat) + feesVat + accessoriesVat,
      totalGrossBeforeDiscount: finalGross,
      totalNetAfterDiscount:
        Math.round(quoteData.totals.total_net) + feesNet + accessoriesNet,
      totalVatAfterDiscount:
        Math.round(quoteData.totals.total_vat) + feesVat + accessoriesVat,
      totalGrossAfterDiscount: finalGross
    }

    const { tenantCompanyLogoBase64, turinovaLogoBase64 } = await loadPdfLogos(
      tenantCompany.logo_url
    )

    const fullHtml = generateQuotePdfHtml({
      quote: quoteData,
      tenantCompany: tenantCompanyToPdf(tenantCompany),
      summary,
      discountAmount: 0,
      discountPercentage: 0,
      tenantCompanyLogoBase64,
      turinovaLogoBase64
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any = null
    try {
      browser = await launchPdfBrowser()
      const page = await browser.newPage()
      const hasBarcode = Boolean(quoteData.barcode?.trim())
      await page.setJavaScriptEnabled(hasBarcode)
      await page.setRequestInterception(true)
      page.on('request', (req: {
        abort: () => void
        continue: () => void
        url: () => string
        resourceType: () => string
      }) => {
        if (
          hasBarcode &&
          req.url().includes('jsdelivr.net') &&
          req.resourceType() === 'script'
        ) {
          req.continue()
          return
        }
        req.abort()
      })

      await page.setContent(fullHtml, {
        waitUntil: hasBarcode ? 'load' : 'domcontentloaded'
      })

      if (hasBarcode) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        await page
          .waitForFunction(
            (id: string) => {
              const svg = document.getElementById(id)
              return Boolean(svg && svg.children.length > 0)
            },
            { timeout: 5000 },
            `barcode-${quoteData.id}`
          )
          .catch(() => {
            console.warn('Barcode SVG did not render in time')
          })
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: 1,
        margin: {
          top: '8mm',
          right: '4mm',
          bottom: '8mm',
          left: '4mm'
        }
      })

      await browser.close()
      browser = null

      const fileSizeMB = pdfBuffer.length / (1024 * 1024)
      if (fileSizeMB > 3) {
        console.warn(`PDF size (${fileSizeMB.toFixed(2)}MB) exceeds 3MB limit`)
      }

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Arajanlat-${quoteData.quote_number}.pdf"`,
          'Content-Length': String(pdfBuffer.length)
        }
      })
    } finally {
      if (browser) await browser.close().catch(() => undefined)
    }
  } catch (error: unknown) {
    console.error('Error generating PDF:', error)
    const message =
      error instanceof Error ? error.message : 'Ismeretlen hiba'
    return NextResponse.json(
      { error: 'Hiba történt a PDF generálása során: ' + message },
      { status: 500 }
    )
  }
}
