/**
 * Számlázz.hu Agent XML for shop-portal orders — mirrors main-app POS invoice logic
 * (normal / előleg / díjbekérő, preview with elonezetpdf, advance deduction, discounts).
 */

import { shopOrderBillingName } from '@/lib/szamlazz-shop-order-invoice'

export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function billingAddressLine(order: Record<string, unknown>): string {
  const a1 = String(order.billing_address1 ?? '').trim()
  const a2 = String(order.billing_address2 ?? '').trim()
  return [a1, a2].filter(Boolean).join(', ')
}

export function getShopItemVatRate(
  item: Record<string, unknown>,
  vatRatesMap: Map<string, number>
): number {
  const tr = Number(item.tax_rate)
  if (!Number.isNaN(tr) && tr > 0) return tr
  const vid = item.vat_id as string | undefined
  if (vid && vatRatesMap.has(vid)) return vatRatesMap.get(vid) || 0
  return 0
}

export type ShopInvoiceXmlSettings = {
  invoiceType: 'normal' | 'advance' | 'proforma' | 'simplified'
  paymentMethod: 'cash' | 'bank_transfer' | 'card'
  dueDate: string
  fulfillmentDate?: string
  comment: string
  language: string
  sendEmail: boolean
  advanceAmount?: number | string
  proformaAmount?: number | string
}

export type ExistingAdvanceRef = { provider_invoice_number: string; gross_total: number } | null
export type ExistingProformaRef = { provider_invoice_number: string; gross_total?: number } | null

type TenantCompanyLite = { email?: string | null } | null

const paymentMethodMap: Record<string, string> = {
  cash: 'készpénz',
  bank_transfer: 'átutalás',
  card: 'bankkártya'
}

function mapPaymentMethod(code: string): string {
  return paymentMethodMap[code] || 'átutalás'
}

function addShippingTetel(
  order: Record<string, unknown>,
  itemsXml: string
): string {
  const shipGross = Number(order.shipping_total_gross) || 0
  const shipNet = Number(order.shipping_total_net) || 0
  if (shipGross <= 0 || shipNet < 0) return itemsXml
  const nettoErtek = Math.round(shipNet)
  const bruttoErtek = Math.round(shipGross)
  const afaErtek = bruttoErtek - nettoErtek
  let vatRate = 27
  if (nettoErtek > 0) {
    const r = Math.round((afaErtek / nettoErtek) * 100)
    if (r >= 0 && r <= 99) vatRate = r
  }
  const nettoEgysegar = nettoErtek
  return (
    itemsXml +
    `
      <tetel>
        <megnevezes>Szállítás</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${nettoEgysegar}</nettoEgysegar>
        <afakulcs>${vatRate}</afakulcs>
        <nettoErtek>${nettoErtek}</nettoErtek>
        <afaErtek>${afaErtek}</afaErtek>
        <bruttoErtek>${bruttoErtek}</bruttoErtek>
      </tetel>`
  )
}

/** Build line items + shipping + advance deduction + discount (shared by final + preview). */
function buildTetelekSection(
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  vatRatesMap: Map<string, number>,
  settings: ShopInvoiceXmlSettings,
  existingAdvanceInvoice: ExistingAdvanceRef,
  existingProformaInvoice: ExistingProformaRef
): string {
  const isAdvanceInvoice = settings.invoiceType === 'advance'
  let proformaAmountNum = 0
  if (settings.proformaAmount != null && settings.proformaAmount !== '') {
    const parsed =
      typeof settings.proformaAmount === 'string'
        ? parseFloat(settings.proformaAmount.replace(/[^\d.-]/g, ''))
        : Number(settings.proformaAmount)
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
      proformaAmountNum = parsed
    }
  }
  const isProformaWithAmount = settings.invoiceType === 'proforma' && proformaAmountNum > 0
  const advanceAmount =
    typeof settings.advanceAmount === 'string'
      ? parseFloat(settings.advanceAmount.replace(/[^\d.-]/g, '')) || 0
      : Number(settings.advanceAmount) || 0

  let itemsXml = ''

  if (isAdvanceInvoice && advanceAmount > 0) {
    let advanceVatRate = 27
    if (items.length > 0) {
      const rates = items.map((item) => getShopItemVatRate(item, vatRatesMap))
      advanceVatRate = Math.max(...rates, 27)
    }
    const advanceBrutto = Math.round(advanceAmount)
    const advanceVatPrecise = (advanceBrutto / (100 + advanceVatRate)) * advanceVatRate
    const advanceVat = Math.round(advanceVatPrecise)
    const advanceNet = advanceBrutto - advanceVat
    itemsXml = `
      <tetel>
        <megnevezes>Előleg</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${advanceNet}</nettoEgysegar>
        <afakulcs>${advanceVatRate}</afakulcs>
        <nettoErtek>${advanceNet}</nettoErtek>
        <afaErtek>${advanceVat}</afaErtek>
        <bruttoErtek>${advanceBrutto}</bruttoErtek>
      </tetel>`
  } else if (isProformaWithAmount) {
    let proformaVatRate = 27
    if (items.length > 0) {
      const rates = items.map((item) => getShopItemVatRate(item, vatRatesMap))
      proformaVatRate = Math.max(...rates, 27)
    }
    const proformaBrutto = Math.round(proformaAmountNum)
    const proformaVatPrecise = (proformaBrutto / (100 + proformaVatRate)) * proformaVatRate
    const proformaVat = Math.round(proformaVatPrecise)
    const proformaNet = proformaBrutto - proformaVat
    itemsXml = `
      <tetel>
        <megnevezes>Előleg</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${proformaNet}</nettoEgysegar>
        <afakulcs>${proformaVatRate}</afakulcs>
        <nettoErtek>${proformaNet}</nettoErtek>
        <afaErtek>${proformaVat}</afaErtek>
        <bruttoErtek>${proformaBrutto}</bruttoErtek>
      </tetel>`
  } else {
    itemsXml = items
      .map((item) => {
        const vatRate = getShopItemVatRate(item, vatRatesMap)
        const mennyiseg = Number(item.quantity) || 0
        const nettoErtek = Math.round(Number(item.line_total_net ?? item.total_net ?? 0))
        const bruttoErtek = Math.round(Number(item.line_total_gross ?? item.total_gross ?? 0))
        const afaErtek = bruttoErtek - nettoErtek
        const nettoEgysegar = mennyiseg > 0 ? nettoErtek / mennyiseg : 0
        return `
      <tetel>
        <megnevezes>${escapeXml(String(item.product_name ?? ''))}</megnevezes>
        <mennyiseg>${mennyiseg}</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${nettoEgysegar}</nettoEgysegar>
        <afakulcs>${vatRate}</afakulcs>
        <nettoErtek>${nettoErtek}</nettoErtek>
        <afaErtek>${afaErtek}</afaErtek>
        <bruttoErtek>${bruttoErtek}</bruttoErtek>
      </tetel>`
      })
      .join('')

    itemsXml = addShippingTetel(order, itemsXml)
  }

  const isNormalInvoiceForFinal =
    settings.invoiceType === 'normal' && !isAdvanceInvoice && !isProformaWithAmount

  let advanceDeductionXml = ''
  if (existingAdvanceInvoice && isNormalInvoiceForFinal) {
    const advanceGross = existingAdvanceInvoice.gross_total
    let advanceVatRate = 27
    if (items.length > 0) {
      const rates = items.map((item) => getShopItemVatRate(item, vatRatesMap))
      advanceVatRate = Math.max(...rates, 27)
    }
    const advanceBrutto = Math.round(advanceGross)
    const advanceVatPrecise = (advanceBrutto / (100 + advanceVatRate)) * advanceVatRate
    const advanceVat = Math.round(advanceVatPrecise)
    const advanceNet = advanceBrutto - advanceVat
    advanceDeductionXml = `
      <tetel>
        <megnevezes>Előleg a termék vásárlásra (${escapeXml(existingAdvanceInvoice.provider_invoice_number)} alapján)</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${-advanceNet}</nettoEgysegar>
        <afakulcs>${advanceVatRate}</afakulcs>
        <nettoErtek>${-advanceNet}</nettoErtek>
        <afaErtek>${-advanceVat}</afaErtek>
        <bruttoErtek>${-advanceBrutto}</bruttoErtek>
      </tetel>`
  }

  let discountXml = ''
  const discountAmount = Number(order.discount_amount) || 0
  if (!isAdvanceInvoice && !isProformaWithAmount && discountAmount > 0) {
    let discountVatRate = 27
    if (items.length > 0) {
      const vatTotals = new Map<number, number>()
      items.forEach((item) => {
        const vatRate = getShopItemVatRate(item, vatRatesMap)
        const itemGross = Math.round(Number(item.line_total_gross ?? item.total_gross ?? 0))
        const currentTotal = vatTotals.get(vatRate) || 0
        vatTotals.set(vatRate, currentTotal + itemGross)
      })
      let maxGross = 0
      vatTotals.forEach((gross, rate) => {
        if (gross > maxGross) {
          maxGross = gross
          discountVatRate = rate
        }
      })
    }
    const roundedDiscountAmount = Math.round(discountAmount)
    const discountNetPrecise = roundedDiscountAmount / (1 + discountVatRate / 100)
    const discountNet = Math.round(discountNetPrecise)
    const discountVat = roundedDiscountAmount - discountNet
    const discountBrutto = -roundedDiscountAmount
    const discountName =
      Number(order.discount_percentage) > 0
        ? `Kedvezmény (${order.discount_percentage}%)`
        : 'Kedvezmény'
    discountXml = `
      <tetel>
        <megnevezes>${escapeXml(discountName)}</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${-discountNet}</nettoEgysegar>
        <afakulcs>${discountVatRate}</afakulcs>
        <nettoErtek>${-discountNet}</nettoErtek>
        <afaErtek>${-discountVat}</afaErtek>
        <bruttoErtek>${discountBrutto}</bruttoErtek>
      </tetel>`
  }

  return `${itemsXml}${advanceDeductionXml}${discountXml}`
}

/**
 * Final invoice XML (real Számla / előleg / díjbekérő) — eszamla true for normal & simplified.
 */
export function buildShopFinalInvoiceXml(
  agentKey: string,
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenantCompany: TenantCompanyLite,
  vatRatesMap: Map<string, number>,
  settings: ShopInvoiceXmlSettings,
  existingAdvanceInvoice: ExistingAdvanceRef,
  existingProformaInvoice: ExistingProformaRef
): string {
  const paymentMethod = mapPaymentMethod(settings.paymentMethod)
  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = settings.dueDate || invoiceDate
  const fulfillmentDate = settings.fulfillmentDate || invoiceDate
  const orderNumber = String(order.order_number ?? '')

  const isAdvanceInvoice = settings.invoiceType === 'advance'
  let proformaAmountNum = 0
  if (settings.proformaAmount != null && settings.proformaAmount !== '') {
    const parsed =
      typeof settings.proformaAmount === 'string'
        ? parseFloat(String(settings.proformaAmount).replace(/[^\d.-]/g, ''))
        : Number(settings.proformaAmount)
    if (!isNaN(parsed) && parsed > 0) proformaAmountNum = parsed
  }
  const isProformaWithAmount = settings.invoiceType === 'proforma' && proformaAmountNum > 0

  const tetelekInner = buildTetelekSection(
    order,
    items,
    vatRatesMap,
    settings,
    existingAdvanceInvoice,
    existingProformaInvoice
  )

  const billingName = shopOrderBillingName(order)
  const customerEmail = String(order.customer_email ?? '').trim()

  // E-mail értesítéshez az Agent általában e-számlát vár; díjbekérő/előleg esetén korábban false volt,
  // így a Számlázz.hu nem küldött e-mailt még sendEmail=true mellett sem.
  const eszamla =
    settings.sendEmail ||
    settings.invoiceType === 'simplified' ||
    settings.invoiceType === 'normal'
      ? 'true'
      : 'false'

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    <eszamla>${eszamla}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
  </beallitasok>
  <fejlec>
    <keltDatum>${invoiceDate}</keltDatum>
    <teljesitesDatum>${fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${dueDate}</fizetesiHataridoDatum>
    <fizmod>${paymentMethod}</fizmod>
    <penznem>Ft</penznem>
    <szamlaNyelve>${settings.language.toLowerCase()}</szamlaNyelve>
    <megjegyzes>${escapeXml(settings.comment || '')}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumber)}</rendelesSzam>
    ${settings.invoiceType === 'proforma' ? '<dijbekero>true</dijbekero>' : ''}
    ${
      existingProformaInvoice &&
      settings.invoiceType === 'normal' &&
      !existingAdvanceInvoice &&
      !isAdvanceInvoice
        ? `<dijbekeroSzamlaszam>${escapeXml(existingProformaInvoice.provider_invoice_number)}</dijbekeroSzamlaszam>`
        : ''
    }
    ${isAdvanceInvoice ? '<elolegszamla>true</elolegszamla>' : ''}
    ${
      existingAdvanceInvoice &&
      !isAdvanceInvoice &&
      !isProformaWithAmount &&
      settings.invoiceType !== 'proforma' &&
      settings.invoiceType !== 'advance'
        ? '<vegszamla>true</vegszamla>'
        : ''
    }
    ${
      existingAdvanceInvoice &&
      !isAdvanceInvoice &&
      !isProformaWithAmount &&
      settings.invoiceType !== 'proforma' &&
      settings.invoiceType !== 'advance'
        ? `<elolegSzamlaszam>${escapeXml(existingAdvanceInvoice.provider_invoice_number)}</elolegSzamlaszam>`
        : ''
    }
  </fejlec>
  <elado>
    ${tenantCompany?.email ? `<emailReplyto>${escapeXml(tenantCompany.email)}</emailReplyto>` : ''}
    <emailTargy>${escapeXml(`Számla - ${orderNumber}`)}</emailTargy>
    <emailSzoveg>${escapeXml('Tisztelettel küldjük számláját.')}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(billingName)}</nev>
    <irsz>${escapeXml(String(order.billing_postcode ?? ''))}</irsz>
    <telepules>${escapeXml(String(order.billing_city ?? ''))}</telepules>
    <cim>${escapeXml(billingAddressLine(order))}</cim>
    <email>${escapeXml(customerEmail)}</email>
    <sendEmail>${settings.sendEmail && customerEmail ? 'true' : 'false'}</sendEmail>
    <adoszam>${escapeXml(String(order.billing_tax_number ?? ''))}</adoszam>
  </vevo>
  <tetelek>
    ${tetelekInner}
  </tetelek>
</xmlszamla>`
}

/**
 * Template preview XML — eszamla false, elonezetpdf true (PDF in response).
 */
export function buildShopTemplatePreviewXml(
  agentKey: string,
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenantCompany: TenantCompanyLite,
  vatRatesMap: Map<string, number>,
  settings: ShopInvoiceXmlSettings,
  existingAdvanceInvoice: ExistingAdvanceRef,
  existingProformaInvoice: ExistingProformaRef,
  orderNumberForXml: string
): string {
  const paymentMethod = mapPaymentMethod(settings.paymentMethod)
  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = settings.dueDate || invoiceDate
  const fulfillmentDate = settings.fulfillmentDate || invoiceDate

  const isAdvanceInvoice = settings.invoiceType === 'advance'
  let proformaAmountNum = 0
  if (settings.proformaAmount != null && settings.proformaAmount !== '') {
    const parsed =
      typeof settings.proformaAmount === 'string'
        ? parseFloat(settings.proformaAmount.replace(/[^\d.-]/g, ''))
        : Number(settings.proformaAmount)
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
      proformaAmountNum = parsed
    }
  }
  const isProformaWithAmount = settings.invoiceType === 'proforma' && proformaAmountNum > 0
  const isNormalInvoiceForFinal =
    settings.invoiceType === 'normal' && !isAdvanceInvoice && !isProformaWithAmount

  const tetelekInner = buildTetelekSection(
    order,
    items,
    vatRatesMap,
    settings,
    existingAdvanceInvoice,
    existingProformaInvoice
  )

  const billingName = shopOrderBillingName(order)
  const customerEmail = String(order.customer_email ?? '').trim()
  const tax = String(order.billing_tax_number ?? '').trim()

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    <eszamla>false</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
  </beallitasok>
  <fejlec>
    <keltDatum>${invoiceDate}</keltDatum>
    <teljesitesDatum>${fulfillmentDate}</teljesitesDatum>
    <fizetesiHataridoDatum>${dueDate}</fizetesiHataridoDatum>
    <fizmod>${paymentMethod}</fizmod>
    <penznem>Ft</penznem>
    <szamlaNyelve>${settings.language.toLowerCase()}</szamlaNyelve>
    <megjegyzes>${escapeXml(settings.comment || '')}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumberForXml)}</rendelesSzam>
    ${settings.invoiceType === 'proforma' ? '<dijbekero>true</dijbekero>' : ''}
    ${
      existingProformaInvoice &&
      (isAdvanceInvoice ||
        (settings.invoiceType === 'normal' && !existingAdvanceInvoice && !isAdvanceInvoice))
        ? `<dijbekeroSzamlaszam>${escapeXml(existingProformaInvoice.provider_invoice_number)}</dijbekeroSzamlaszam>`
        : ''
    }
    ${isAdvanceInvoice ? '<elolegszamla>true</elolegszamla>' : ''}
    ${existingAdvanceInvoice && isNormalInvoiceForFinal ? '<vegszamla>true</vegszamla>' : ''}
    ${
      existingAdvanceInvoice && isNormalInvoiceForFinal
        ? `<elolegSzamlaszam>${escapeXml(existingAdvanceInvoice.provider_invoice_number)}</elolegSzamlaszam>`
        : ''
    }
    <elonezetpdf>true</elonezetpdf>
  </fejlec>
  <elado>
    ${tenantCompany?.email ? `<emailReplyto>${escapeXml(tenantCompany.email)}</emailReplyto>` : ''}
    <emailTargy>${escapeXml(`Számla - ${orderNumberForXml}`)}</emailTargy>
    <emailSzoveg>${escapeXml('Tisztelettel küldjük számláját.')}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(billingName)}</nev>
    <irsz>${escapeXml(String(order.billing_postcode ?? ''))}</irsz>
    <telepules>${escapeXml(String(order.billing_city ?? ''))}</telepules>
    <cim>${escapeXml(billingAddressLine(order))}</cim>
    <email>${escapeXml(customerEmail)}</email>
    <sendEmail>false</sendEmail>
    ${tax ? `<adoszam>${escapeXml(tax)}</adoszam>` : '<adoalany>-1</adoalany>'}
  </vevo>
  <tetelek>
    ${tetelekInner}
  </tetelek>
</xmlszamla>`
}

export function calculateShopOrderTotalGross(
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>
): number {
  let totalGrossBeforeDiscount = 0
  items.forEach((item) => {
    totalGrossBeforeDiscount += Math.round(Number(item.line_total_gross ?? item.total_gross ?? 0))
  })
  totalGrossBeforeDiscount += Math.round(Number(order.shipping_total_gross) || 0)
  const discountAmountValue = Number(order.discount_amount) || 0
  return Math.round(totalGrossBeforeDiscount - discountAmountValue)
}
