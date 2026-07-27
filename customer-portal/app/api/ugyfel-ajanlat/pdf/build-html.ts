import { promises as fs } from 'fs'
import { join } from 'path'

import {
  resolveAccentHex,
  resolveCustomerNotes,
  resolveLeadTimeNote,
  resolvePaymentText,
  resolvePdfPaletteId,
  resolveProjectTitle,
  resolveShowVatNote,
  sanitizeWorkshopLogoDataUrl
} from '@/lib/customer-facing-pdf-extras'
import {
  createClient,
  generatePortalCustomerQuoteNumber,
  getPortalCustomerQuoteById,
  getPortalNettfrontQuoteById,
  getPortalQuoteById
} from '@/lib/supabase-server'
import type { CustomerQuoteSnapshot } from '@/lib/portal-customer-quotes'

import generateEmptyCustomerFacingPdfHtml from './pdf-template'

export type EmptyPdfBody = {
  preparedBy?: string
  validUntil?: string
  projectTitle?: string
  paymentSchedule?: string
  paymentCustomText?: string
  leadTimeNote?: string
  customerNotes?: string
  paletteId?: string
  accentHex?: string
  showVatNote?: boolean | string | number
  workshopLogoDataUrl?: string
  /** Mentett ügyfélajánlat id — frissítés / snapshot PDF. */
  customerQuoteId?: string
  /** Snapshotból render (újra PDF a hubról). */
  useSnapshot?: boolean | string | number
  buyer?: {
    name?: string
    phone?: string
    email?: string
    postalCode?: string
    city?: string
    street?: string
    taxNumber?: string
  }
  portalSources?: Array<{
    type?: string
    id?: string
    markupPercent?: number
    roundTo?: number
    lineDisplay?: string
  }>
  manualLines?: Array<{
    type?: string
    title?: string
    quantity?: number
    unit?: string
    unitPriceGross?: number
  }>
}

export type PortalPdfRow = {
  title: string
  subtitle?: string
  quantityLabel: string
  unitPriceGross: number
  lineTotalGross: number
}

function resolveValidUntilDisplay(validUntil: string | undefined): string {
  const raw = String(validUntil || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${y}.${m}.${d}.`
  }
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${mo}.${day}.`
}

function makeQuoteNumber() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const r = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `UA-${y}${m}${day}-${r}`
}

function truthyFlag(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

function computePayableGross(
  portalRows: Array<{ lineTotalGross?: number; unitPriceGross?: number }>,
  manualLines: Array<{ quantity: number; unitPriceGross: number }>
): number {
  const portalTotal = portalRows.reduce((sum, row) => {
    const total =
      row.lineTotalGross != null ? Number(row.lineTotalGross) : Number(row.unitPriceGross)
    return sum + Math.round(total || 0)
  }, 0)
  const manualTotal = manualLines.reduce(
    (sum, line) => sum + Math.round((Number(line.quantity) || 0) * (Number(line.unitPriceGross) || 0)),
    0
  )
  return portalTotal + manualTotal
}

function applyRounding(n: number, roundTo: number): number {
  const rounded = Math.round(n)
  if (!roundTo || roundTo <= 0) return rounded
  return Math.round(rounded / roundTo) * roundTo
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function getServiceName(serviceType: string) {
  switch (serviceType) {
    case 'panthelyfuras':
      return 'Pánthely fúrás'
    case 'duplungolas':
      return 'Duplungolás'
    case 'szogvagas':
      return 'Szögvágás'
    default:
      return serviceType
  }
}

function getServiceUnit(serviceType: string) {
  switch (serviceType) {
    case 'panthelyfuras':
    case 'szogvagas':
      return 'db'
    case 'duplungolas':
      return 'm²'
    default:
      return 'db'
  }
}

function reconcileToMarked(rows: PortalPdfRow[], marked: number): PortalPdfRow[] {
  if (rows.length === 0) return rows
  const sum = rows.reduce((s, r) => s + r.lineTotalGross, 0)
  const diff = marked - sum
  if (diff === 0) return rows
  const last = rows[rows.length - 1]
  const nextTotal = Math.max(0, last.lineTotalGross + diff)
  return [
    ...rows.slice(0, -1),
    {
      ...last,
      lineTotalGross: nextTotal,
      unitPriceGross:
        last.quantityLabel === '1 db' ? nextTotal : Math.max(0, last.unitPriceGross)
    }
  ]
}

function collapsedRow(title: string, subtitle: string, marked: number): PortalPdfRow {
  return {
    title,
    subtitle,
    quantityLabel: '1 db',
    unitPriceGross: marked,
    lineTotalGross: marked
  }
}

function buildOptiDetailedRows(quote: any, marked: number): PortalPdfRow[] {
  const board = Number(quote.final_total_after_discount) || 0
  const factor = board > 0 ? marked / board : 1
  const pricing = Array.isArray(quote.pricing) ? quote.pricing : []
  const quoteNumber = String(quote.quote_number || '')
  const rows: PortalPdfRow[] = []

  for (const p of pricing) {
    const materialGross = Number(p.material_gross) || 0
    if (materialGross <= 0) continue
    const chargedSqm = Number(p.charged_sqm) || 0
    const wasteMulti = Number(p.waste_multi) || 1
    const boardsUsed = Number(p.boards_used) || 0
    const displaySqm = wasteMulti > 0 ? chargedSqm / wasteMulti : chargedSqm
    const lineTotal = Math.round(materialGross * factor)
    const unitPrice = displaySqm > 0 ? Math.round(lineTotal / displaySqm) : lineTotal
    const dims = [p.board_length_mm, p.board_width_mm, p.thickness_mm]
      .filter(v => v != null && v !== '')
      .join('×')
    rows.push({
      title: String(p.material_name || 'Laptermék'),
      subtitle: [quoteNumber, dims ? `${dims} mm` : ''].filter(Boolean).join(' · '),
      quantityLabel: `${displaySqm.toFixed(2)} m² / ${boardsUsed} db`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  let totalCuttingLength = 0
  let totalCuttingGross = 0
  for (const p of pricing) {
    if ((Number(p.cutting_gross) || 0) > 0) {
      totalCuttingLength += Number(p.cutting_length_m) || 0
      totalCuttingGross += Number(p.cutting_gross) || 0
    }
  }
  if (totalCuttingGross > 0) {
    const lineTotal = Math.round(totalCuttingGross * factor)
    const unitPrice =
      totalCuttingLength > 0 ? Math.round(lineTotal / totalCuttingLength) : lineTotal
    rows.push({
      title: 'Szabás díj',
      subtitle: quoteNumber || undefined,
      quantityLabel: `${totalCuttingLength.toFixed(2)} m`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  let totalEdgeLength = 0
  let totalEdgeGross = 0
  for (const p of pricing) {
    if ((Number(p.edge_materials_gross) || 0) > 0) {
      totalEdgeGross += Number(p.edge_materials_gross) || 0
      const edges = p.portal_quote_edge_materials_breakdown
      if (Array.isArray(edges)) {
        for (const edge of edges) {
          totalEdgeLength += Number(edge.total_length_m) || 0
        }
      }
    }
  }
  if (totalEdgeGross > 0) {
    const lineTotal = Math.round(totalEdgeGross * factor)
    const unitPrice = totalEdgeLength > 0 ? Math.round(lineTotal / totalEdgeLength) : lineTotal
    rows.push({
      title: 'Élzárás',
      subtitle: quoteNumber || undefined,
      quantityLabel: `${totalEdgeLength.toFixed(2)} m`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  const servicesMap = new Map<string, { quantity: number; gross: number }>()
  for (const p of pricing) {
    const services = p.portal_quote_services_breakdown
    if (!Array.isArray(services)) continue
    for (const service of services) {
      const type = String(service.service_type || 'other')
      const existing = servicesMap.get(type)
      if (existing) {
        existing.quantity += Number(service.quantity) || 0
        existing.gross += Number(service.gross_price) || 0
      } else {
        servicesMap.set(type, {
          quantity: Number(service.quantity) || 0,
          gross: Number(service.gross_price) || 0
        })
      }
    }
  }
  for (const [serviceType, data] of servicesMap) {
    if (data.gross <= 0) continue
    const lineTotal = Math.round(data.gross * factor)
    const unitPrice = data.quantity > 0 ? Math.round(lineTotal / data.quantity) : lineTotal
    const unit = getServiceUnit(serviceType)
    rows.push({
      title: getServiceName(serviceType),
      subtitle: quoteNumber || undefined,
      quantityLabel: `${data.quantity} ${unit}`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  if (rows.length === 0) {
    return [collapsedRow('Lapszabászat (korpusz)', quoteNumber, marked)]
  }
  return reconcileToMarked(rows, marked)
}

function buildNettfrontDetailedRows(quote: any, marked: number): PortalPdfRow[] {
  const lines = Array.isArray(quote.lines) ? quote.lines : []
  const quoteNumber = String(quote.quote_number || '')
  const bySku = new Map<
    string,
    {
      display_name: string
      finish: string | null
      front_type: string
      panels_db: number
      total_sqm: number
      gross: number
    }
  >()

  for (const line of lines) {
    const key = `${line.front_type || 'inomat'}:${line.sku_code || line.display_name}`
    const prev = bySku.get(key)
    const area = Number(line.area_sqm) || 0
    if (!prev) {
      bySku.set(key, {
        display_name: String(line.display_name || 'Front'),
        finish: line.finish ?? null,
        front_type: String(line.front_type || 'inomat'),
        panels_db: Number(line.quantity) || 0,
        total_sqm: area,
        gross: Number(line.line_gross) || 0
      })
    } else {
      prev.panels_db += Number(line.quantity) || 0
      prev.total_sqm = round2(prev.total_sqm + area)
      prev.gross = round2(prev.gross + (Number(line.line_gross) || 0))
    }
  }

  const totalHoles = lines.reduce(
    (s: number, l: any) => s + (Number(l.panthely_holes_total) || 0),
    0
  )
  const servicesGross = Number(quote.services_total_gross) || 0
  const frontGrossRaw =
    (Number(quote.lines_total_gross) || 0) + servicesGross ||
    Array.from(bySku.values()).reduce((s, r) => s + r.gross, 0) + servicesGross
  const factor = frontGrossRaw > 0 ? marked / frontGrossRaw : 1

  const rows: PortalPdfRow[] = []
  for (const row of bySku.values()) {
    if (row.gross <= 0) continue
    const lineTotal = Math.round(row.gross * factor)
    const unitPrice = row.total_sqm > 0 ? Math.round(lineTotal / row.total_sqm) : lineTotal
    const finish = row.finish ? String(row.finish) : ''
    rows.push({
      title: row.display_name,
      subtitle: [quoteNumber, finish].filter(Boolean).join(' · '),
      quantityLabel: `${row.total_sqm.toFixed(2)} m² / ${row.panels_db} db`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  if (totalHoles > 0 && servicesGross > 0) {
    const lineTotal = Math.round(servicesGross * factor)
    const unitPrice = totalHoles > 0 ? Math.round(lineTotal / totalHoles) : lineTotal
    rows.push({
      title: 'Pánthely fúrás',
      subtitle: quoteNumber || undefined,
      quantityLabel: `${totalHoles} db`,
      unitPriceGross: unitPrice,
      lineTotalGross: lineTotal
    })
  }

  if (rows.length === 0) {
    return [collapsedRow('Nettfront (frontok)', quoteNumber, marked)]
  }
  return reconcileToMarked(rows, marked)
}

async function resolvePortalSourceRows(
  raw: EmptyPdfBody['portalSources']
): Promise<
  | { ok: true; rows: PortalPdfRow[] }
  | { ok: false; error: string; status: number }
> {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const normalized: Array<{
    type: 'lapszabaszat' | 'nettfront'
    id: string
    markupPercent: number
    roundTo: number
    lineDisplay: 'collapsed' | 'detailed'
  }> = []

  for (const item of list.slice(0, 8)) {
    const type =
      item?.type === 'nettfront'
        ? 'nettfront'
        : item?.type === 'lapszabaszat'
          ? 'lapszabaszat'
          : null
    const id = String(item?.id || '').trim()
    if (!type || !id) continue
    const key = `${type}:${id}`
    if (seen.has(key)) continue
    seen.add(key)
    const markupPercent = Math.max(0, Math.min(500, Number(item?.markupPercent) || 0))
    const roundToRaw = Number(item?.roundTo) || 0
    const roundTo = roundToRaw === 100 || roundToRaw === 1000 ? roundToRaw : 0
    const lineDisplay =
      item?.lineDisplay === 'detailed' ? 'detailed' : 'collapsed'
    normalized.push({ type, id, markupPercent, roundTo, lineDisplay })
  }

  if (list.length > 8) {
    return {
      ok: false,
      error: 'Legfeljebb 8 portál forrás adható egy ajánlathoz.',
      status: 400
    }
  }

  const rows: PortalPdfRow[] = []

  for (const src of normalized) {
    if (src.type === 'lapszabaszat') {
      const quote = await getPortalQuoteById(src.id)
      if (!quote) {
        return {
          ok: false,
          error: `A lapszabászat ajánlat nem található: ${src.id.slice(0, 8)}…`,
          status: 404
        }
      }
      const board = Number(quote.final_total_after_discount) || 0
      const marked = applyRounding(board * (1 + src.markupPercent / 100), src.roundTo)
      if (src.lineDisplay === 'detailed') {
        rows.push(...buildOptiDetailedRows(quote, marked))
      } else {
        rows.push(collapsedRow('Lapszabászat (korpusz)', quote.quote_number, marked))
      }
    } else {
      const quote = await getPortalNettfrontQuoteById(src.id)
      if (!quote) {
        return {
          ok: false,
          error: `A Nettfront ajánlat nem található: ${src.id.slice(0, 8)}…`,
          status: 404
        }
      }
      const board = Number(quote.final_total_after_discount) || 0
      const marked = applyRounding(board * (1 + src.markupPercent / 100), src.roundTo)
      if (src.lineDisplay === 'detailed') {
        rows.push(...buildNettfrontDetailedRows(quote, marked))
      } else {
        rows.push(collapsedRow('Nettfront (frontok)', quote.quote_number, marked))
      }
    }
  }

  return { ok: true, rows }
}

export async function buildEmptyCustomerFacingHtml(
  body: EmptyPdfBody,
  opts: { preview: boolean }
): Promise<
  | {
      ok: true
      html: string
      quoteNumber: string
      portalCustomerId: string
      customerQuoteId: string | null
      payableGross: number
      portalSourceRows: PortalPdfRow[]
      manualLines: Array<{
        type: string
        title: string
        quantity: number
        unit: string
        unitPriceGross: number
      }>
      snapshot: CustomerQuoteSnapshot
      fromSnapshot: boolean
    }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, error: 'Nincs bejelentkezés', status: 401 }
  }

  const { data: seller, error: sellerError } = await supabase
    .from('portal_customers')
    .select(
      `
      id, name, email, mobile,
      billing_name, billing_postal_code, billing_city,
      billing_street, billing_house_number, billing_tax_number
    `
    )
    .eq('id', user.id)
    .single()

  if (sellerError || !seller) {
    return { ok: false, error: 'Profil nem található', status: 404 }
  }

  const sellerName = String(seller.billing_name || seller.name || '').trim()
  if (!sellerName) {
    return {
      ok: false,
      error: 'Hiányzik az ajánlat adó cégnév. Egészítsd ki a profilodat.',
      status: 400
    }
  }

  const customerQuoteIdRaw = String(body.customerQuoteId || '').trim()
  const existingQuote = customerQuoteIdRaw
    ? await getPortalCustomerQuoteById(customerQuoteIdRaw)
    : null

  if (customerQuoteIdRaw && !existingQuote) {
    return { ok: false, error: 'A mentett ügyfélajánlat nem található', status: 404 }
  }

  const useSnapshot = truthyFlag(body.useSnapshot) && Boolean(existingQuote)
  if (truthyFlag(body.useSnapshot) && !existingQuote) {
    return {
      ok: false,
      error: 'Snapshot PDF-hez add meg a mentett ajánlat azonosítóját',
      status: 400
    }
  }

  let turinovaLogoBase64 = ''
  try {
    const logoPath = join(process.cwd(), 'public', 'images', 'turinova-logo.png')
    const buf = await fs.readFile(logoPath)
    turinovaLogoBase64 = buf.toString('base64')
  } catch {
    /* optional */
  }

  const sellerStreet = [seller.billing_street, seller.billing_house_number]
    .filter(Boolean)
    .join(' ')

  const workshop = {
    name: sellerName,
    phone: seller.mobile || null,
    email: seller.email || null,
    address: sellerStreet || null,
    city: seller.billing_city || null,
    postalCode: seller.billing_postal_code || null,
    taxNumber: seller.billing_tax_number || null
  }

  if (useSnapshot && existingQuote) {
    const snap = existingQuote.snapshot
    if (!snap.portalSourceRows?.length && !snap.manualLines?.length) {
      return {
        ok: false,
        error: 'Ehhez az ajánlathoz nincs mentett PDF-pillanatkép. Nyisd meg szerkesztésre.',
        status: 410
      }
    }

    const portalSourceRows: PortalPdfRow[] = (snap.portalSourceRows || []).map(row => ({
      title: String(row.title || ''),
      subtitle: row.subtitle ? String(row.subtitle) : undefined,
      quantityLabel: String(row.quantityLabel || '1 db'),
      unitPriceGross: Math.round(Number(row.unitPriceGross) || 0),
      lineTotalGross: Math.round(
        Number(row.lineTotalGross != null ? row.lineTotalGross : row.unitPriceGross) || 0
      )
    }))
    const manualLines = (snap.manualLines || []).map(line => ({
      type: String(line.type || 'other'),
      title: String(line.title || '').trim(),
      quantity: Number(line.quantity) || 0,
      unit: String(line.unit || 'db').trim() || 'db',
      unitPriceGross: Number(line.unitPriceGross) || 0
    }))
    const payableGross =
      Number(snap.payableGross) || computePayableGross(portalSourceRows, manualLines)
    const quoteNumber = existingQuote.quote_number || snap.quoteNumber
    const createdAt = snap.createdAt || existingQuote.created_at
    const workshopLogoDataUrl = sanitizeWorkshopLogoDataUrl(body.workshopLogoDataUrl)

    const html = generateEmptyCustomerFacingPdfHtml({
      quoteNumber,
      createdAt,
      workshop,
      buyer: {
        name: snap.buyer?.name || existingQuote.buyer_name || '—',
        email: snap.buyer?.email || '',
        mobile: snap.buyer?.mobile || '',
        billing_name: snap.buyer?.billing_name || snap.buyer?.name || '—',
        billing_city: snap.buyer?.billing_city || '',
        billing_postal_code: snap.buyer?.billing_postal_code || '',
        billing_street: snap.buyer?.billing_street || '',
        billing_house_number: snap.buyer?.billing_house_number || '',
        billing_tax_number: snap.buyer?.billing_tax_number || ''
      },
      preparedBy: snap.preparedBy || '—',
      portalSourceRows,
      manualLines,
      validUntilDisplay: snap.validUntilDisplay || resolveValidUntilDisplay(undefined),
      turinovaLogoBase64,
      workshopLogoDataUrl,
      projectTitle: snap.projectTitle,
      paymentText: snap.paymentText,
      leadTimeNote: snap.leadTimeNote,
      customerNotes: snap.customerNotes,
      paletteId: resolvePdfPaletteId(snap.paletteId),
      accentHex: resolveAccentHex(snap.accentHex),
      showVatNote: resolveShowVatNote(snap.showVatNote)
    })

    const snapshot: CustomerQuoteSnapshot = {
      ...snap,
      quoteNumber,
      payableGross,
      portalSourceRows,
      manualLines
    }

    return {
      ok: true,
      html,
      quoteNumber,
      portalCustomerId: user.id,
      customerQuoteId: existingQuote.id,
      payableGross,
      portalSourceRows,
      manualLines,
      snapshot,
      fromSnapshot: true
    }
  }

  const preparedByRaw = String(body.preparedBy || '').trim()
  if (!opts.preview && !preparedByRaw) {
    return { ok: false, error: 'A „Készítette” mező kötelező', status: 400 }
  }
  const preparedBy = preparedByRaw || (opts.preview ? '—' : '')

  const buyerIn = body.buyer || {}
  const buyerName = String(buyerIn.name || '').trim()
  if (!opts.preview && !buyerName) {
    return { ok: false, error: 'A vevő neve kötelező', status: 400 }
  }

  const portalResolved = await resolvePortalSourceRows(body.portalSources)
  if (!portalResolved.ok) {
    return portalResolved
  }
  const portalSourceRows = portalResolved.rows

  const manualLines = (Array.isArray(body.manualLines) ? body.manualLines : [])
    .map(line => ({
      type: String(line.type || 'other'),
      title: String(line.title || '').trim(),
      quantity: Number(line.quantity) || 0,
      unit: String(line.unit || 'db').trim() || 'db',
      unitPriceGross: Number(line.unitPriceGross) || 0
    }))
    .filter(line => line.title && line.quantity > 0)
    .slice(0, 15)

  if (!opts.preview && manualLines.length === 0 && portalSourceRows.length === 0) {
    return {
      ok: false,
      error: 'Legalább egy tétel vagy portál forrás szükséges',
      status: 400
    }
  }

  let quoteNumber = existingQuote?.quote_number || ''
  if (!quoteNumber && !opts.preview) {
    quoteNumber = (await generatePortalCustomerQuoteNumber()) || makeQuoteNumber()
  }
  if (!quoteNumber) {
    quoteNumber = makeQuoteNumber()
  }

  const createdAt = existingQuote?.created_at || new Date().toISOString()
  const validUntilDisplay = resolveValidUntilDisplay(body.validUntil)
  const projectTitle = resolveProjectTitle(body.projectTitle)
  const paymentText = resolvePaymentText(body.paymentSchedule, body.paymentCustomText)
  const leadTimeNote = resolveLeadTimeNote(body.leadTimeNote)
  const customerNotes = resolveCustomerNotes(body.customerNotes)
  const paletteId = resolvePdfPaletteId(body.paletteId)
  const accentHex = resolveAccentHex(body.accentHex)
  const showVatNote = resolveShowVatNote(body.showVatNote)
  const workshopLogoDataUrl = sanitizeWorkshopLogoDataUrl(body.workshopLogoDataUrl)

  const buyer = {
    name: buyerName || '—',
    email: String(buyerIn.email || ''),
    mobile: String(buyerIn.phone || ''),
    billing_name: buyerName || '—',
    billing_city: String(buyerIn.city || ''),
    billing_postal_code: String(buyerIn.postalCode || ''),
    billing_street: String(buyerIn.street || ''),
    billing_house_number: '',
    billing_tax_number: String(buyerIn.taxNumber || '')
  }

  const html = generateEmptyCustomerFacingPdfHtml({
    quoteNumber,
    createdAt,
    workshop,
    buyer,
    preparedBy,
    portalSourceRows,
    manualLines,
    validUntilDisplay,
    turinovaLogoBase64,
    workshopLogoDataUrl,
    projectTitle,
    paymentText,
    leadTimeNote,
    customerNotes,
    paletteId,
    accentHex,
    showVatNote
  })

  const payableGross = computePayableGross(portalSourceRows, manualLines)
  const snapshot: CustomerQuoteSnapshot = {
    quoteNumber,
    createdAt,
    preparedBy,
    buyer,
    portalSourceRows,
    manualLines,
    payableGross,
    validUntilDisplay,
    projectTitle: projectTitle || undefined,
    paymentText: paymentText || undefined,
    leadTimeNote: leadTimeNote || undefined,
    customerNotes: customerNotes || undefined,
    paletteId,
    accentHex,
    showVatNote
  }

  return {
    ok: true,
    html,
    quoteNumber,
    portalCustomerId: user.id,
    customerQuoteId: existingQuote?.id || null,
    payableGross,
    portalSourceRows,
    manualLines,
    snapshot,
    fromSnapshot: false
  }
}
