'use server'

import { revalidatePath } from 'next/cache'

import {
  cuttingFeeFormSchema,
  grossToNet,
  parseMoneyInput,
  type PricingMode
} from '@/lib/cutting-fees/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type CuttingFeeActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const OPTI_SETTINGS_PATH = '/beallitasok/opti'
const OPTI_PATH = '/opti'

export async function upsertCuttingFee(input: {
  feePerMeterGrossRaw: string
  duplungolasFeePerSqmGrossRaw: string
  szogvagasFeePerPanelGrossRaw: string
  panthelyfurasFeePerHoleGrossRaw: string
  taxRateId: string
  pricingMode: PricingMode
}): Promise<CuttingFeeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const feeGrossParsed = parseMoneyInput(input.feePerMeterGrossRaw)
  const duplungGrossParsed = parseMoneyInput(input.duplungolasFeePerSqmGrossRaw)
  const szogGrossParsed = parseMoneyInput(input.szogvagasFeePerPanelGrossRaw)
  const panthelyGrossParsed = parseMoneyInput(
    input.panthelyfurasFeePerHoleGrossRaw
  )
  const parsed = cuttingFeeFormSchema.safeParse({
    feePerMeterGross: feeGrossParsed,
    duplungolasFeePerSqmGross: duplungGrossParsed ?? 0,
    szogvagasFeePerPanelGross: szogGrossParsed ?? 0,
    panthelyfurasFeePerHoleGross: panthelyGrossParsed ?? 0,
    taxRateId: input.taxRateId,
    pricingMode: input.pricingMode
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors
    }
  }

  const tenantId = ctx.user.tenantId!

  const { data: tax, error: taxError } = await ctx.supabase
    .from('tax_rates')
    .select('id, rate_percent')
    .eq('id', parsed.data.taxRateId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (taxError || !tax) {
    return {
      ok: false,
      message: 'A választott ÁFA kulcs nem található.',
      fieldErrors: { taxRateId: 'Válassz érvényes ÁFA kulcsot.' }
    }
  }

  const rate = Number(tax.rate_percent)
  const feePerMeterGross = Math.round(parsed.data.feePerMeterGross)
  const feePerMeterNet = grossToNet(feePerMeterGross, rate)

  if (feePerMeterGross <= 0 || feePerMeterNet <= 0) {
    return {
      ok: false,
      message: 'A számított nettó díj érvénytelen.',
      fieldErrors: { feePerMeterGross: 'Adj meg nagyobb bruttó összeget.' }
    }
  }

  const duplungGross = Math.round(parsed.data.duplungolasFeePerSqmGross)
  const szogGross = Math.round(parsed.data.szogvagasFeePerPanelGross)
  const panthelyGross = Math.round(parsed.data.panthelyfurasFeePerHoleGross)
  const duplungNet = duplungGross === 0 ? 0 : grossToNet(duplungGross, rate)
  const szogNet = szogGross === 0 ? 0 : grossToNet(szogGross, rate)
  const panthelyNet = panthelyGross === 0 ? 0 : grossToNet(panthelyGross, rate)

  const { data: existing, error: existingError } = await ctx.supabase
    .from('cutting_fees')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingError) {
    console.error('upsertCuttingFee existing', existingError.message)
    return { ok: false, message: 'Nem sikerült menteni az Opti beállításokat.' }
  }

  const payload = {
    fee_per_meter: feePerMeterNet,
    fee_per_meter_gross: feePerMeterGross,
    duplungolas_fee_per_sqm: duplungNet,
    duplungolas_fee_per_sqm_gross: duplungGross,
    szogvagas_fee_per_panel: szogNet,
    szogvagas_fee_per_panel_gross: szogGross,
    panthelyfuras_fee_per_hole: panthelyNet,
    panthelyfuras_fee_per_hole_gross: panthelyGross,
    tax_rate_id: tax.id,
    pricing_mode: parsed.data.pricingMode,
    updated_at: new Date().toISOString()
  }

  if (existing) {
    const { error } = await ctx.supabase
      .from('cutting_fees')
      .update(payload)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('upsertCuttingFee update', error.message)
      return {
        ok: false,
        message: 'Nem sikerült menteni az Opti beállításokat.'
      }
    }
  } else {
    const { error } = await ctx.supabase.from('cutting_fees').insert({
      tenant_id: tenantId,
      ...payload
    })

    if (error) {
      console.error('upsertCuttingFee insert', error.message)
      return {
        ok: false,
        message: 'Nem sikerült menteni az Opti beállításokat.'
      }
    }
  }

  revalidatePath(OPTI_SETTINGS_PATH)
  revalidatePath(OPTI_PATH)
  return { ok: true }
}
