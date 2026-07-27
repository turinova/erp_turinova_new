import {
  buildSourcesSummary,
  stripPayloadForStorage
} from '@/lib/portal-customer-quotes'
import { upsertPortalCustomerQuote } from '@/lib/supabase-server'

import type { buildEmptyCustomerFacingHtml } from '@/app/api/ugyfel-ajanlat/pdf/build-html'

type BuiltOk = Extract<
  Awaited<ReturnType<typeof buildEmptyCustomerFacingHtml>>,
  { ok: true }
>

/** Mentés PDF nélkül — payload + snapshot upsert a build eredményéből. */
export async function persistBuiltCustomerQuote(
  body: Record<string, unknown>,
  built: BuiltOk
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const storedPayload = stripPayloadForStorage({
    preparedBy: String(body?.preparedBy || built.snapshot.preparedBy || ''),
    validUntil: String(body?.validUntil || ''),
    projectTitle: body?.projectTitle ? String(body.projectTitle) : undefined,
    paymentSchedule: body?.paymentSchedule as never,
    paymentCustomText: body?.paymentCustomText
      ? String(body.paymentCustomText)
      : undefined,
    leadTimeNote: body?.leadTimeNote ? String(body.leadTimeNote) : undefined,
    customerNotes: body?.customerNotes ? String(body.customerNotes) : undefined,
    paletteId: body?.paletteId as never,
    accentHex: body?.accentHex ? String(body.accentHex) : undefined,
    showVatNote: body?.showVatNote as boolean | undefined,
    buyer: {
      name: String(
        (body?.buyer as { name?: string } | undefined)?.name ||
          built.snapshot.buyer.name ||
          ''
      ),
      phone: String((body?.buyer as { phone?: string } | undefined)?.phone || ''),
      email: String((body?.buyer as { email?: string } | undefined)?.email || ''),
      postalCode: String(
        (body?.buyer as { postalCode?: string } | undefined)?.postalCode || ''
      ),
      city: String((body?.buyer as { city?: string } | undefined)?.city || ''),
      street: String((body?.buyer as { street?: string } | undefined)?.street || ''),
      taxNumber: String(
        (body?.buyer as { taxNumber?: string } | undefined)?.taxNumber || ''
      )
    },
    pricing: (body?.pricing as never) || {
      markupPercent: 0,
      lineDisplay: 'collapsed' as const,
      roundTo: 0 as const
    },
    portalSources: Array.isArray(body?.portalSources)
      ? (body.portalSources as never)
      : undefined,
    manualLines: built.manualLines.map(l => ({
      type: (l.type as 'shipping' | 'assembly' | 'hardware' | 'fee' | 'other') || 'other',
      title: l.title,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceGross: l.unitPriceGross
    })),
    customerQuoteId: built.customerQuoteId || undefined
  })

  const sourcesSummary = buildSourcesSummary(
    body?.portalSources as never,
    built.manualLines.length
  )

  const saved = await upsertPortalCustomerQuote({
    id: built.customerQuoteId,
    portalCustomerId: built.portalCustomerId,
    quoteNumber: built.quoteNumber,
    buyerName: built.snapshot.buyer.name || '',
    projectTitle: built.snapshot.projectTitle || null,
    payableGross: built.payableGross,
    sourcesSummary,
    payload: storedPayload,
    snapshot: built.snapshot
  })

  if (!saved.ok) return saved

  if (saved.id && storedPayload.customerQuoteId !== saved.id) {
    await upsertPortalCustomerQuote({
      id: saved.id,
      portalCustomerId: built.portalCustomerId,
      quoteNumber: built.quoteNumber,
      buyerName: built.snapshot.buyer.name || '',
      projectTitle: built.snapshot.projectTitle || null,
      payableGross: built.payableGross,
      sourcesSummary,
      payload: { ...storedPayload, customerQuoteId: saved.id },
      snapshot: built.snapshot
    })
  }

  return { ok: true, id: saved.id }
}
