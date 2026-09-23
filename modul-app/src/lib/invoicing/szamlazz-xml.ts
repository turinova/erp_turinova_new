import { escapeXml } from '@/lib/invoicing/szamlazz-agent'
import type { InvoiceIssueKind, InvoicePaymentMethod } from '@/lib/invoicing/types'

export type SaleInvoiceBuyer = {
  name: string
  postalCode: string
  city: string
  address: string
  email: string
  taxNumber: string
}

export type SaleInvoiceSeller = {
  email: string | null
}

export type SaleInvoiceLine = {
  name: string
  quantity: number
  unit: string
  unitNet: number
  vatPercent: number
  lineNet: number
  lineVat: number
  lineGross: number
}

export type SaleInvoiceXmlInput = {
  agentKey: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment: string
  language: string
  sendEmail: boolean
  markAsPaid: boolean
  orderNumber: string
  buyer: SaleInvoiceBuyer
  seller: SaleInvoiceSeller
  lines: SaleInvoiceLine[]
  /** Bruttó előleg / rész-díjbekérő összeg (ha kind advance/proforma partial). */
  amountGross?: number | null
  existingAdvanceNumber?: string | null
  existingProformaNumber?: string | null
  preview?: boolean
}

const PAYMENT_LABEL: Record<InvoicePaymentMethod, string> = {
  cash: 'készpénz',
  bank_transfer: 'átutalás',
  card: 'bankkártya'
}

function buildLinesXml(input: SaleInvoiceXmlInput): string {
  const isAdvance = input.kind === 'advance'
  const amount =
    input.amountGross != null && input.amountGross > 0
      ? Math.round(input.amountGross)
      : 0
  const isPartialProforma = input.kind === 'proforma' && amount > 0

  if (isAdvance || isPartialProforma) {
    const vatRate = 27
    const brutto = amount
    const vat = Math.round((brutto / (100 + vatRate)) * vatRate)
    const net = brutto - vat
    const label = isAdvance ? 'Előleg' : 'Díjbekérő'
    return `
      <tetel>
        <megnevezes>${escapeXml(label)}</megnevezes>
        <mennyiseg>1</mennyiseg>
        <mennyisegiEgyseg>db</mennyisegiEgyseg>
        <nettoEgysegar>${net}</nettoEgysegar>
        <afakulcs>${vatRate}</afakulcs>
        <nettoErtek>${net}</nettoErtek>
        <afaErtek>${vat}</afaErtek>
        <bruttoErtek>${brutto}</bruttoErtek>
      </tetel>`
  }

  let xml = ''
  for (const line of input.lines) {
    const qty = Number(line.quantity) || 0
    if (qty <= 0) continue
    const vatRate = Math.round(line.vatPercent)
    const lineNet = Math.round(line.lineNet)
    const lineVat = Math.round(line.lineVat)
    const lineGross = Math.round(line.lineGross)
    const unitNet =
      qty > 0 ? Math.round((lineNet / qty) * 1000) / 1000 : line.unitNet
    xml += `
      <tetel>
        <megnevezes>${escapeXml(line.name)}</megnevezes>
        <mennyiseg>${qty}</mennyiseg>
        <mennyisegiEgyseg>${escapeXml(line.unit || 'db')}</mennyisegiEgyseg>
        <nettoEgysegar>${unitNet}</nettoEgysegar>
        <afakulcs>${vatRate}</afakulcs>
        <nettoErtek>${lineNet}</nettoErtek>
        <afaErtek>${lineVat}</afaErtek>
        <bruttoErtek>${lineGross}</bruttoErtek>
      </tetel>`
  }

  if (input.existingAdvanceNumber && input.kind === 'normal') {
    // Előleg levonás tételként nem kell — fejlec elolegSzamlaszam intézi
  }

  return xml
}

export function buildSaleInvoiceXml(input: SaleInvoiceXmlInput): string {
  const isAdvance = input.kind === 'advance'
  const isProforma = input.kind === 'proforma'
  const invoiceDate = new Date().toISOString().split('T')[0]
  const due = input.dueDate || invoiceDate
  const fulfill = input.fulfillmentDate || invoiceDate
  const email = input.buyer.email.trim()
  const sendEmail = input.sendEmail && Boolean(email)
  const eszamla = input.preview ? 'false' : sendEmail || input.kind === 'normal' ? 'true' : 'false'

  const tetelek = buildLinesXml(input)
  if (!tetelek.trim()) {
    throw new Error('Nincs számlázható tétel.')
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(input.agentKey)}</szamlaagentkulcs>
    <eszamla>${eszamla}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
    <aggregator></aggregator>
  </beallitasok>
  <fejlec>
    <keltDatum>${invoiceDate}</keltDatum>
    <teljesitesDatum>${fulfill}</teljesitesDatum>
    <fizetesiHataridoDatum>${due}</fizetesiHataridoDatum>
    <fizmod>${PAYMENT_LABEL[input.paymentMethod]}</fizmod>
    <penznem>Ft</penznem>
    <szamlaNyelve>${escapeXml(input.language.toLowerCase())}</szamlaNyelve>
    <megjegyzes>${escapeXml(input.comment || '')}</megjegyzes>
    <arfolyamBank>MNB</arfolyamBank>
    <arfolyam>1</arfolyam>
    <rendelesSzam>${escapeXml(input.orderNumber)}</rendelesSzam>
    ${isProforma ? '<dijbekero>true</dijbekero>' : ''}
    ${
      input.existingProformaNumber && input.kind === 'normal' && !input.existingAdvanceNumber
        ? `<dijbekeroSzamlaszam>${escapeXml(input.existingProformaNumber)}</dijbekeroSzamlaszam>`
        : ''
    }
    ${isAdvance ? '<elolegszamla>true</elolegszamla>' : ''}
    ${
      input.existingAdvanceNumber && input.kind === 'normal'
        ? '<vegszamla>true</vegszamla>'
        : ''
    }
    ${
      input.existingAdvanceNumber && input.kind === 'normal'
        ? `<elolegSzamlaszam>${escapeXml(input.existingAdvanceNumber)}</elolegSzamlaszam>`
        : ''
    }
    ${input.markAsPaid && input.kind === 'normal' ? '<fizetve>true</fizetve>' : ''}
    ${input.preview ? '<elonezetpdf>true</elonezetpdf>' : ''}
  </fejlec>
  <elado>
    ${input.seller.email ? `<emailReplyto>${escapeXml(input.seller.email)}</emailReplyto>` : ''}
    <emailTargy>${escapeXml(`Számla - ${input.orderNumber}`)}</emailTargy>
    <emailSzoveg>${escapeXml('Tisztelettel küldjük a számlát.')}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escapeXml(input.buyer.name)}</nev>
    <irsz>${escapeXml(input.buyer.postalCode)}</irsz>
    <telepules>${escapeXml(input.buyer.city)}</telepules>
    <cim>${escapeXml(input.buyer.address)}</cim>
    <email>${escapeXml(email)}</email>
    <sendEmail>${sendEmail ? 'true' : 'false'}</sendEmail>
    <adoszam>${escapeXml(input.buyer.taxNumber)}</adoszam>
  </vevo>
  <tetelek>
    ${tetelek}
  </tetelek>
</xmlszamla>`
}

export function buildStornoXml(opts: {
  agentKey: string
  invoiceNumber: string
  buyerEmail?: string | null
}): string {
  const today = new Date().toISOString().split('T')[0]
  const email = String(opts.buyerEmail || '').trim()
  const shouldSend = email.length > 0
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamlast xmlns="http://www.szamlazz.hu/xmlszamlast" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamlast https://www.szamlazz.hu/szamla/docs/xsds/agentst/xmlszamlast.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escapeXml(opts.agentKey)}</szamlaagentkulcs>
    <eszamla>${shouldSend ? 'true' : 'false'}</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <szamlaLetoltesPld>1</szamlaLetoltesPld>
  </beallitasok>
  <fejlec>
    <szamlaszam>${escapeXml(opts.invoiceNumber)}</szamlaszam>
    <keltDatum>${today}</keltDatum>
    <tipus>SS</tipus>
  </fejlec>
  <elado>
    <emailTargy>${escapeXml(`Sztornó számla - ${opts.invoiceNumber}`)}</emailTargy>
    <emailSzoveg>${escapeXml('Tisztelettel küldjük a sztornó számlát.')}</emailSzoveg>
  </elado>
  <vevo>
    ${shouldSend ? `<email>${escapeXml(email)}</email>` : ''}
  </vevo>
</xmlszamlast>`
}
