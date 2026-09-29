import { redirect } from 'next/navigation'

type SearchParams = Promise<{
  page?: string
  q?: string
  search?: string
  view?: string
  type?: string
  lifecycle?: string
}>

/** Régi lapszabászat-bizonylat lista → egységes Pénzügy / Bizonylatok. */
export default async function AjanlatokBizonylatokRedirect({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  params.set('source', 'opti_order')
  const q = (sp.q ?? sp.search)?.trim()
  if (q) params.set('q', q)
  if (sp.view) params.set('view', sp.view)
  else if (sp.type === 'szamla') params.set('view', 'invoices')
  else if (sp.type === 'sztorno') params.set('view', 'stornos')
  else if (sp.lifecycle === 'pending_proforma' || sp.type === 'dijbekero') {
    /* default awaiting — no view param */
  }
  if (sp.page && sp.page !== '1') params.set('page', sp.page)
  redirect(`/szamlak?${params.toString()}`)
}
