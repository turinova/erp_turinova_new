import CustomerQuoteStudio from '@/components/muhely-ajanlat/CustomerQuoteStudio'
import {
  parseStudioSourceRefs,
  sellerFromPortalCustomer,
  sourceProductLabel,
  type QuoteSourceInfo,
  type RecentSavedQuote
} from '@/components/muhely-ajanlat/customerFacingPdfShared'
import {
  portalSourcesFromPayload,
  sourcePricingFromPayload,
  type CustomerQuoteStoredPayload,
  type PortalCustomerQuoteRecord
} from '@/lib/portal-customer-quotes'
import {
  createClient,
  getPortalCustomerQuoteById,
  getPortalNettfrontQuoteById,
  getPortalQuoteById,
  getUnifiedSavedQuotes,
  getUnifiedSubmittedQuotesLight
} from '@/lib/supabase-server'

export const metadata = {
  title: 'Ügyfélajánlat szerkesztő - Turinova Ügyfélportál',
  description: 'Ügyfélajánlat generátor élő előnézettel'
}

type PageProps = {
  searchParams: Promise<{
    s?: string
    cid?: string
    from?: string
    id?: string
    lapszabaszat?: string
    nettfront?: string
  }>
}

function mapQuotes(
  quotes: Array<{
    id: string
    quote_number: string
    final_total_after_discount: number
    updated_at: string
    type: 'opti' | 'nettfront'
  }>,
  origin: RecentSavedQuote['origin']
): RecentSavedQuote[] {
  return quotes.map(q => ({
    id: q.id,
    quote_number: q.quote_number,
    final_total_after_discount: q.final_total_after_discount,
    updated_at: q.updated_at,
    type: q.type,
    origin
  }))
}

export default async function UgyfelAjanlatStudioPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cid = String(params.cid || '').trim()

  let savedQuote: PortalCustomerQuoteRecord | null = null
  if (cid) {
    savedQuote = await getPortalCustomerQuoteById(cid)
    if (!savedQuote) {
      return (
        <div className="flex flex-col gap-2 p-4">
          <h1 className="text-xl font-bold">Ügyfélajánlat</h1>
          <p className="text-red-600">A mentett ajánlat nem található.</p>
          <a href="/ugyfel-ajanlat" className="text-green-700 font-semibold underline">
            Vissza a listához
          </a>
        </div>
      )
    }
  }

  const urlRefs = parseStudioSourceRefs({
    s: params.s,
    lapszabaszat: params.lapszabaszat,
    nettfront: params.nettfront,
    from: params.from,
    id: params.id
  })

  const payloadRefs = savedQuote
    ? portalSourcesFromPayload(savedQuote.payload as CustomerQuoteStoredPayload)
    : []

  // URL s= elsőbbséget élvez (forráscsere a pickerrel); cid-only → mentett payload források
  const refs = urlRefs.length > 0 ? urlRefs : payloadRefs

  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Nincs bejelentkezés</div>
  }

  const { data: customer } = await supabase
    .from('portal_customers')
    .select(
      `
      id, name, email, mobile,
      billing_name, billing_postal_code, billing_city,
      billing_street, billing_house_number, billing_tax_number,
      workshop_logo_data_url
    `
    )
    .eq('id', user.id)
    .single()

  if (!customer) {
    return <div>Profil nem található</div>
  }

  const sources: QuoteSourceInfo[] = []
  const errors: string[] = []
  let sellerRecord: Record<string, unknown> = customer as Record<string, unknown>

  for (const ref of refs) {
    if (ref.type === 'lapszabaszat') {
      const quote = await getPortalQuoteById(ref.id)
      if (!quote) {
        errors.push(`Lapszabászat nem elérhető (${ref.id.slice(0, 8)}…).`)
        continue
      }
      sources.push({
        type: 'lapszabaszat',
        id: quote.id,
        quoteNumber: quote.quote_number,
        boardGross: Number(quote.final_total_after_discount) || 0,
        productLabel: sourceProductLabel('lapszabaszat'),
        previewUrl: `/api/portal-quotes/${quote.id}/customer-facing-pdf/preview`,
        pdfUrl: `/api/portal-quotes/${quote.id}/customer-facing-pdf`
      })
    } else {
      const quote = await getPortalNettfrontQuoteById(ref.id)
      if (!quote) {
        errors.push(`Nettfront nem elérhető (${ref.id.slice(0, 8)}…).`)
        continue
      }
      sources.push({
        type: 'nettfront',
        id: quote.id,
        quoteNumber: quote.quote_number,
        boardGross: Number(quote.final_total_after_discount) || 0,
        productLabel: sourceProductLabel('nettfront'),
        previewUrl: `/api/nettfront-quotes/${quote.id}/customer-facing-pdf/preview`,
        pdfUrl: `/api/nettfront-quotes/${quote.id}/customer-facing-pdf`
      })
    }
  }

  const [drafts, ordered] = await Promise.all([
    getUnifiedSavedQuotes(1, 30),
    getUnifiedSubmittedQuotesLight(1, 30)
  ])

  const recentQuotes = [
    ...mapQuotes(drafts.quotes, 'draft'),
    ...mapQuotes(ordered.quotes, 'ordered')
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  if (errors.length > 0 && sources.length === 0 && refs.length > 0 && !savedQuote) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <h1 className="text-xl font-bold">Ügyfélajánlat</h1>
        <p className="text-red-600">{errors.join(' ')}</p>
        <a href="/ugyfel-ajanlat/uj" className="text-green-700 font-semibold underline">
          Üres ajánlat indítása
        </a>
      </div>
    )
  }

  const initialSourcePricing = savedQuote
    ? sourcePricingFromPayload(savedQuote.payload)
    : undefined

  return (
    <CustomerQuoteStudio
      seller={sellerFromPortalCustomer(sellerRecord)}
      sources={sources}
      recentQuotes={recentQuotes}
      loadWarnings={[
        ...errors,
        ...(savedQuote && refs.length > 0 && sources.length < refs.length
          ? ['Egy vagy több mentett forrás már nem elérhető — cseréld vagy távolítsd el.']
          : [])
      ]}
      savedQuoteId={savedQuote?.id || null}
      savedQuoteNumber={savedQuote?.quote_number || null}
      savedPayload={savedQuote?.payload || null}
      initialSourcePricing={initialSourcePricing}
    />
  )
}
