import { createHash } from 'node:crypto'

import { adatkezelesDoc } from '@/lib/webshop/legal/templates/adatkezeles'
import { aszfDoc } from '@/lib/webshop/legal/templates/aszf'
import {
  akadalymentessegDoc,
  elallasDoc,
  impresszumDoc,
  panaszkezelesDoc,
  sutikDoc,
  szallitasFizetesDoc
} from '@/lib/webshop/legal/templates/other'
import type { LegalContext, LegalDoc, LegalDocKind } from '@/lib/webshop/legal/types'

const RENDERERS: Record<LegalDocKind, (ctx: LegalContext) => LegalDoc> = {
  aszf: aszfDoc,
  adatkezeles: adatkezelesDoc,
  elallas: elallasDoc,
  'szallitas-es-fizetes': szallitasFizetesDoc,
  panaszkezeles: panaszkezelesDoc,
  impresszum: impresszumDoc,
  sutik: sutikDoc,
  akadalymentesseg: akadalymentessegDoc
}

export function renderLegalDoc(kind: LegalDocKind, ctx: LegalContext): LegalDoc {
  return RENDERERS[kind](ctx)
}

/** A dokumentum tartalmának ujjlenyomata — ha változik, új verzió készül. */
export function hashDoc(doc: LegalDoc): string {
  return createHash('sha256').update(JSON.stringify(doc)).digest('hex')
}
