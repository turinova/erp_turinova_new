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
  taxRateId: string
  pricingMode: PricingMode
}): Promise<CuttingFeeActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const gross = parseMoneyInput(input.feePerMeterGrossRaw)
  const parsed = cuttingFeeFormSchema.safeParse({
    feePerMeterGross: gross,
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

  const feePerMeterNet = grossToNet(
    parsed.data.feePerMeterGross,
    Number(tax.rate_percent)
  )

  if (feePerMeterNet <= 0) {
    return {
      ok: false,
      message: 'A számított nettó díj érvénytelen.',
      fieldErrors: { feePerMeterGross: 'Adj meg nagyobb bruttó összeget.' }
    }
  }

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
      fee_per_meter: feePerMeterNet,
      tax_rate_id: tax.id,
      pricing_mode: parsed.data.pricingMode
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
