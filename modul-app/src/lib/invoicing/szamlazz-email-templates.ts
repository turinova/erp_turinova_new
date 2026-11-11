import type { InvoiceIssueKind, InvoicePaymentMethod } from '@/lib/invoicing/types'

/**
 * Számlázz.hu számlaértesítő tárgy + szöveg. A [címkéket] a Számlázz.hu tölti ki
 * küldéskor (tudastar.szamlazz.hu/gyik/szamlaertesito-egyedi-mezok); a címkék
 * ékezetesen, pontosan így írandók. Sortörés = kézi sortörés, formázás = BB kód.
 * Szövegben nincs gondolatjel / kötőjel (copy szabály).
 */
export type SzamlazzEmailTemplate = { subject: string; body: string }

export type InvoiceEmailContext = {
  kind: InvoiceIssueKind
  /** Végszámla kifizetettként megy ki (`<fizetve>true</fizetve>`). */
  paid: boolean
  /** Végszámla korábbi előlegszámla után. */
  afterAdvance: boolean
  paymentMethod: InvoicePaymentMethod
}

const SIGNATURE = ['Üdvözlettel:', '[cégnév]']

function lines(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string').join('\n')
}

function payByTransfer(amountTag: string, reference: string): string[] {
  return [
    `Fizetendő: [b]${amountTag}[/b]`,
    'Fizetési határidő: [b][határidő][/b]',
    'Bankszámlaszám: [bankszámlaszám]',
    `Közlemény: ${reference}`
  ]
}

export function invoiceEmailTemplate(ctx: InvoiceEmailContext): SzamlazzEmailTemplate {
  if (ctx.kind === 'proforma') {
    return {
      subject: 'Díjbekérő a(z) [rendelésszám] rendeléshez ([cégnév])',
      body: lines(
        'Kedves [vevőneve]!',
        '',
        'Mellékelten küldjük a(z) [rendelésszám] rendeléshez tartozó díjbekérőt.',
        '',
        ...payByTransfer('[összeg]', '[rendelésszám]'),
        '',
        'A díjbekérő nem számla. A befizetés után a számlát külön e-mailben küldjük.',
        '',
        ...SIGNATURE
      )
    }
  }

  if (ctx.kind === 'advance') {
    return {
      subject: 'Előlegszámla: [számlaszám] ([cégnév])',
      body: lines(
        'Kedves [vevőneve]!',
        '',
        'Mellékelten küldjük a(z) [rendelésszám] rendeléshez tartozó előlegszámlát.',
        '',
        'Előleg összege: [b][összeg][/b]',
        '',
        'A rendelés végszámláját a teljesítés után küldjük, abban az előleget levonjuk.',
        '',
        ...SIGNATURE
      )
    }
  }

  const transfer = ctx.paymentMethod === 'bank_transfer'

  if (ctx.afterAdvance) {
    return {
      subject: 'Végszámla: [számlaszám] ([cégnév])',
      body: lines(
        'Kedves [vevőneve]!',
        '',
        'Mellékelten küldjük a(z) [rendelésszám] rendelés végszámláját. A korábban befizetett előleget a számlán levontuk.',
        '',
        'Számlaszám: [b][számlaszám][/b]',
        ...(ctx.paid
          ? ['', 'A rendelés teljes összege rendezve van, további teendője nincs.']
          : transfer
            ? ['', ...payByTransfer('[tartozás]', '[számlaszám]')]
            : ['Még fizetendő: [b][tartozás][/b]', 'Fizetési mód: [fizmod]']),
        '',
        'Köszönjük, hogy minket választott!',
        '',
        ...SIGNATURE
      )
    }
  }

  if (ctx.paid) {
    return {
      subject: 'Számlája: [számlaszám] ([cégnév])',
      body: lines(
        'Kedves [vevőneve]!',
        '',
        'Köszönjük a rendelését! Mellékelten küldjük a(z) [rendelésszám] rendeléshez tartozó számlát.',
        '',
        'Számlaszám: [b][számlaszám][/b]',
        'Végösszeg: [b][összeg][/b]',
        'Fizetési mód: [fizmod]',
        '',
        'A számla rendezve van, további teendője nincs.',
        '',
        ...SIGNATURE
      )
    }
  }

  return {
    subject: 'Számlája: [számlaszám] ([cégnév])',
    body: lines(
      'Kedves [vevőneve]!',
      '',
      'Mellékelten küldjük a(z) [rendelésszám] rendeléshez tartozó számlát.',
      '',
      ...(transfer
        ? payByTransfer('[tartozás]', '[számlaszám]')
        : [
            'Fizetendő: [b][tartozás][/b]',
            'Fizetési határidő: [b][határidő][/b]',
            'Fizetési mód: [fizmod]'
          ]),
      '',
      transfer &&
        'Kérjük, a közleményben tüntesse fel a számlaszámot, így gyorsabban tudjuk azonosítani a befizetést.',
      transfer && '',
      ...SIGNATURE
    )
  }
}

export function stornoEmailTemplate(): SzamlazzEmailTemplate {
  return {
    subject: 'Sztornó számla: [számlaszám] ([cégnév])',
    body: lines(
      'Kedves [vevőneve]!',
      '',
      'Mellékelten küldjük a(z) [számlaszám] sorszámú sztornó számlát, amely egy korábbi számlánkat érvényteleníti.',
      '',
      'Ha ezzel kapcsolatban kérdése van, válaszoljon erre az e-mailre, és segítünk.',
      '',
      ...SIGNATURE
    )
  }
}
