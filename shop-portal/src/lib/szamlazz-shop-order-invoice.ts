/**
 * Build Számlázz.hu Agent XML for shop-portal `orders` + `order_items` (normal invoice).
 * Aligns rounding rules with main-app customer/pos invoice routes.
 */

function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type ShopOrderInvoiceSettings = {
  dueDate: string
  fulfillmentDate?: string
  paymentMethod: 'cash' | 'bank_transfer' | 'card'
  comment: string
  language: string
  sendEmail: boolean
}

function mapPaymentMethod(code: string): string {
  const paymentMethodMap: Record<string, string> = {
    cash: 'készpénz',
    bank_transfer: 'átutalás',
    card: 'bankkártya'
  }
  return paymentMethodMap[code] || 'átutalás'
}

/** Billing display name for XML vevo */
export function shopOrderBillingName(order: Record<string, unknown>): string {
  const company = String(order.billing_company ?? '').trim()
  if (company) return company
  const fn = String(order.billing_firstname ?? '').trim()
  const ln = String(order.billing_lastname ?? '').trim()
  return [fn, ln].filter(Boolean).join(' ') || String(order.customer_firstname ?? '') + ' ' + String(order.customer_lastname ?? '')
}

function billingAddressLine(order: Record<string, unknown>): string {
  const a1 = String(order.billing_address1 ?? '').trim()
  const a2 = String(order.billing_address2 ?? '').trim()
  return [a1, a2].filter(Boolean).join(', ')
}

export function buildShopOrderInvoiceXml(
  agentKey: string,
  order: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  settings: ShopOrderInvoiceSettings
): string {
  const paymentMethod = mapPaymentMethod(settings.paymentMethod)
  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = settings.dueDate || invoiceDate
  const fulfillmentDate = settings.fulfillmentDate || dueDate
  const orderNumber = String(order.order_number ?? '')
  const language = (settings.language || 'hu').toLowerCase()

  const customerEmail = String(order.customer_email ?? '').trim()
  const billingName = shopOrderBillingName(order)

  let itemsXml = ''

  for (const item of items) {
    const vatRate = Number(item.tax_rate) || 0
    const mennyiseg = Number(item.quantity) || 0
    const nettoEgysegar = Number(item.unit_price_net) || 0
    const nettoErtek = Math.round(mennyiseg * nettoEgysegar)
    const afaErtek = Math.round((nettoErtek * vatRate) / 100)
    const bruttoErtek = nettoErtek + afaErtek

    itemsXml += `
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
  }

  const shipGross = Number(order.shipping_total_gross) || 0
  const shipNet = Number(order.shipping_total_net) || 0
  if (shipGross > 0 && shipNet >= 0) {
    const nettoErtek = Math.round(shipNet)
    const bruttoErtek = Math.round(shipGross)
    const afaErtek = bruttoErtek - nettoErtek
    let vatRate = 27
    if (nettoErtek > 0) {
      vatRate = Math.round((afaErtek / nettoErtek) * 100)
      if (vatRate < 0 || vatRate > 99) vatRate = 27
    }
    const nettoEgysegar = nettoErtek
    itemsXml += `
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
  }

  const discountAmount = Number(order.discount_amount) || 0
  if (discountAmount > 0 && items.length > 0) {
    let discountVatRate = 27
    const rates = items.map((it) => Number(it.tax_rate) || 0).filter((r) => r > 0)
    if (rates.length > 0) discountVatRate = Math.max(...rates, 27)

    const roundedDiscount = Math.round(discountAmount)
    const discountNetPrecise = roundedDiscount / (1 + discountVatRate / 100)
    const discountNet = Math.round(discountNetPrecise)
    const discountVat = roundedDiscount - discountNet
    const discountBrutto = -roundedDiscount

    const discountName =
      Number(order.discount_percentage) > 0
        ? `Kedvezmény (${order.discount_percentage}%)`
        : 'Kedvezmény'

    itemsXml += `
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
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
    <szamlaNyelve>${language}</szamlaNyelve>
    <megjegyzes>${escapeXml(settings.comment || '')}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(orderNumber)}</rendelesSzam>
  </fejlec>
  <elado>
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
    ${itemsXml}
  </tetelek>
</xmlszamla>`

  return xml
}
