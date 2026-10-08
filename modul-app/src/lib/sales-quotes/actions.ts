'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import { updateCustomer } from '@/lib/customers/actions'
import { createSaleAction } from '@/lib/sales/actions'
import {
  salesQuoteDraftLinesSchema,
  salesQuoteDraftUpdateSchema,
  salesQuoteFormSchema,
  type SalesQuoteBillingInput,
  type SalesQuoteDraftLinesInput,
  type SalesQuoteDraftUpdateInput,
  type SalesQuoteFormInput,
  type SalesQuoteStatus
} from '@/lib/sales-quotes/parse'
import { getSalesQuote } from '@/lib/sales-quotes/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { createClient } from '@/lib/supabase/server'

export type SalesQuoteActionResult =
  | {
      ok: true
      id: string
      quoteNumber?: string
      saleId?: string
      skippedLines?: number
    }
  | { ok: false; message: string; saleId?: string }

const LIST_PATH = '/ertekesitesek/arajanlatok'

function revalidateQuotePaths(id?: string, saleId?: string) {
  revalidatePath(LIST_PATH)
  revalidatePath('/ertekesitesek')
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  if (saleId) revalidatePath(`/ertekesitesek/${saleId}`)
}

function billingToRpc(b: SalesQuoteBillingInput | undefined) {
  if (!b) return null
  return {
    billing_name: b.billingName ?? null,
    billing_country: b.billingCountry || 'Magyarország',
    billing_city: b.billingCity ?? null,
    billing_postal_code: b.billingPostalCode ?? null,
    billing_street: b.billingStreet ?? null,
    billing_house_number: b.billingHouseNumber ?? null,
    billing_tax_number: b.billingTaxNumber ?? null
  }
}

export async function createSalesQuoteAction(
  input: SalesQuoteFormInput
): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = salesQuoteFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc('create_sales_quote', {
    p_warehouse_id: d.warehouseId,
    p_customer_id: d.customerId,
    p_note: d.note ?? null,
    p_valid_until: d.validUntil || null,
    p_items: d.items.map((it) => {
      const kind = it.kind ?? 'product'
      if (kind === 'sheet_material') {
        return {
          line_kind: 'sheet_material',
          sheet_material_id: it.sheetMaterialId,
          quantity: it.quantity,
          unit_price_gross: it.unitPriceGross,
          discount_percentage: it.discountPercentage ?? 0
        }
      }
      if (kind === 'linear_material') {
        return {
          line_kind: 'linear_material',
          linear_material_id: it.linearMaterialId,
          quantity: it.quantity,
          unit_price_gross: it.unitPriceGross,
          discount_percentage: it.discountPercentage ?? 0
        }
      }
      return {
        line_kind: 'product',
        accessory_id: it.accessoryId,
        quantity: it.quantity,
        unit_price_gross: it.unitPriceGross,
        discount_percentage: it.discountPercentage ?? 0
      }
    }),
    p_fees: (d.fees ?? []).map((f) => ({
      fee_type_id: f.feeTypeId ?? null,
      name: f.name,
      quantity: f.quantity,
      unit_price_gross: f.unitPriceGross,
      tax_rate_percent: f.taxRatePercent ?? 27
    })),
    p_discount: { percentage: d.discountPercentage ?? 0 },
    p_billing: billingToRpc(d.billing),
    p_cloned_from_id: d.clonedFromId ?? null
  })

  if (error) {
    console.error('createSalesQuoteAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni az árajánlatot.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    quote_number?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült menteni az árajánlatot.'
    }
  }

  revalidateQuotePaths(result.id)
  return { ok: true, id: result.id, quoteNumber: result.quote_number }
}

export async function updateSalesQuoteDraftAction(
  input: SalesQuoteDraftUpdateInput
): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = salesQuoteDraftUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc('update_sales_quote_draft', {
    p_quote_id: d.quoteId,
    p_note: d.note ?? null,
    p_valid_until: d.validUntil || null,
    p_billing: billingToRpc(d.billing)
  })

  if (error) {
    console.error('updateSalesQuoteDraftAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni az ajánlatot.' }
  }

  const result = data as { ok?: boolean; id?: string; message?: string } | null
  if (!result?.ok) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült menteni az ajánlatot.'
    }
  }

  revalidateQuotePaths(d.quoteId)
  return { ok: true, id: d.quoteId }
}

export async function replaceSalesQuoteDraftLinesAction(
  input: SalesQuoteDraftLinesInput
): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = salesQuoteDraftLinesSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc(
    'replace_sales_quote_draft_lines',
    {
      p_quote_id: d.quoteId,
      p_items: d.items.map((it) => {
        const kind = it.kind ?? 'product'
        if (kind === 'sheet_material') {
          return {
            line_kind: 'sheet_material',
            sheet_material_id: it.sheetMaterialId,
            quantity: it.quantity,
            unit_price_gross: it.unitPriceGross,
            discount_percentage: it.discountPercentage ?? 0
          }
        }
        if (kind === 'linear_material') {
          return {
            line_kind: 'linear_material',
            linear_material_id: it.linearMaterialId,
            quantity: it.quantity,
            unit_price_gross: it.unitPriceGross,
            discount_percentage: it.discountPercentage ?? 0
          }
        }
        return {
          line_kind: 'product',
          accessory_id: it.accessoryId,
          quantity: it.quantity,
          unit_price_gross: it.unitPriceGross,
          discount_percentage: it.discountPercentage ?? 0
        }
      }),
      p_fees: (d.fees ?? []).map((f) => ({
        fee_type_id: f.feeTypeId ?? null,
        name: f.name,
        quantity: f.quantity,
        unit_price_gross: f.unitPriceGross,
        tax_rate_percent: f.taxRatePercent ?? 27
      })),
      p_discount: { percentage: d.discountPercentage ?? 0 }
    }
  )

  if (error) {
    console.error('replaceSalesQuoteDraftLinesAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a tételeket.' }
  }

  const result = data as { ok?: boolean; id?: string; message?: string } | null
  if (!result?.ok) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült menteni a tételeket.'
    }
  }

  revalidateQuotePaths(d.quoteId)
  return { ok: true, id: d.quoteId }
}

/** Opcionális: ajánlat számlázás → ügyféltörzs (explicit megerősítés után). */
export async function syncQuoteBillingToCustomerAction(
  quoteId: string
): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const detail = await getSalesQuote(
    ctx.supabase,
    ctx.user.tenantId!,
    quoteId
  )
  if (!detail) return { ok: false, message: 'Ajánlat nem található.' }

  const { data: live, error: liveErr } = await ctx.supabase
    .from('customers')
    .select(
      'name, email, mobile, sms_notification, billing_company_reg_number'
    )
    .eq('id', detail.customer_id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .maybeSingle()

  if (liveErr || !live) {
    return { ok: false, message: 'Az ügyfél nem található.' }
  }

  const result = await updateCustomer({
    id: detail.customer_id,
    name: live.name,
    email: live.email ?? '',
    mobile: live.mobile ?? '',
    smsNotification: Boolean(live.sms_notification),
    billingName: detail.billing_name ?? '',
    billingCountry: detail.billing_country || 'Magyarország',
    billingCity: detail.billing_city ?? '',
    billingPostalCode: detail.billing_postal_code ?? '',
    billingStreet: detail.billing_street ?? '',
    billingHouseNumber: detail.billing_house_number ?? '',
    billingTaxNumber: detail.billing_tax_number ?? '',
    billingCompanyRegNumber: live.billing_company_reg_number ?? ''
  })

  if (!result.ok) {
    return { ok: false, message: result.message }
  }

  revalidatePath(`/ugyfelek/${detail.customer_id}`)
  revalidateQuotePaths(quoteId)
  return { ok: true, id: quoteId }
}

export async function setSalesQuoteStatusAction(
  quoteId: string,
  status: Exclude<SalesQuoteStatus, 'draft' | 'accepted'>,
  lostReason?: string
): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase.rpc('set_sales_quote_status', {
    p_quote_id: quoteId,
    p_status: status,
    p_lost_reason: lostReason ?? null
  })

  if (error) {
    console.error('setSalesQuoteStatusAction', error.message)
    return { ok: false, message: 'Nem sikerült frissíteni a státuszt.' }
  }

  const result = data as { ok?: boolean; id?: string; message?: string } | null
  if (!result?.ok) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült frissíteni a státuszt.'
    }
  }

  revalidateQuotePaths(quoteId)
  return { ok: true, id: quoteId }
}

export async function convertSalesQuoteToSaleAction(input: {
  quoteId: string
  paymentMethodId: string
  /** true = teljes összeg most; false = utalás / függőben (confirmed unpaid) */
  payInFull?: boolean
}): Promise<SalesQuoteActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const detail = await getSalesQuote(
    ctx.supabase,
    ctx.user.tenantId!,
    input.quoteId
  )
  if (!detail) return { ok: false, message: 'Ajánlat nem található.' }
  if (detail.converted_sale_id) {
    return { ok: false, message: 'Már készült eladás ebből az ajánlatból.' }
  }
  if (detail.status !== 'draft' && detail.status !== 'sent') {
    return { ok: false, message: 'Ebből az állapotból nem készíthető eladás.' }
  }
  if (detail.valid_until) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const until = new Date(detail.valid_until)
    if (until < today) {
      return { ok: false, message: 'Az ajánlat lejárt.' }
    }
  }

  const products = detail.items.filter(
    (i) =>
      i.item_kind === 'product' ||
      i.item_kind === 'sheet_material' ||
      i.item_kind === 'linear_material'
  )
  const fees = detail.items.filter((i) => i.item_kind === 'fee')
  if (products.length === 0) {
    return { ok: false, message: 'Nincs tétel az ajánlaton.' }
  }

  const payInFull = input.payInFull !== false

  const saleResult = await createSaleAction({
    warehouseId: detail.warehouse_id,
    customerId: detail.customer_id,
    channel: 'manual',
    note: detail.note
      ? `Árajánlat ${detail.quote_number}: ${detail.note}`
      : `Árajánlat ${detail.quote_number}`,
    discountPercentage: detail.discount_percentage,
    discountAmount: 0,
    items: products.map((p) => {
      if (p.item_kind === 'sheet_material') {
        return {
          kind: 'sheet_material' as const,
          accessoryId: null,
          sheetMaterialId: p.sheet_material_id!,
          linearMaterialId: null,
          quantity: p.quantity,
          unitPriceGross: p.unit_price_gross,
          discountPercentage: p.discount_percentage,
          discountAmount: 0
        }
      }
      if (p.item_kind === 'linear_material') {
        return {
          kind: 'linear_material' as const,
          accessoryId: null,
          sheetMaterialId: null,
          linearMaterialId: p.linear_material_id!,
          quantity: p.quantity,
          unitPriceGross: p.unit_price_gross,
          discountPercentage: p.discount_percentage,
          discountAmount: 0
        }
      }
      return {
        kind: 'product' as const,
        accessoryId: p.accessory_id!,
        sheetMaterialId: null,
        linearMaterialId: null,
        quantity: p.quantity,
        unitPriceGross: p.unit_price_gross,
        discountPercentage: p.discount_percentage,
        discountAmount: 0
      }
    }),
    fees: fees.map((f) => ({
      feeTypeId: f.fee_type_id,
      name: f.name_snapshot,
      quantity: f.quantity,
      unitPriceGross: f.unit_price_gross,
      taxRatePercent: f.tax_rate_percent
    })),
    payments: payInFull
      ? [
          {
            paymentMethodId: input.paymentMethodId,
            amount: detail.total_gross
          }
        ]
      : [],
    fulfillNow: false
  })

  if (!saleResult.ok) {
    return { ok: false, message: saleResult.message }
  }

  // Ajánlat billing snapshot → eladás (ne a törzs újralekérése)
  const { error: billErr } = await ctx.supabase
    .from('sales_orders')
    .update({
      billing_name_snapshot: detail.billing_name,
      billing_country_snapshot: detail.billing_country || 'Magyarország',
      billing_city_snapshot: detail.billing_city,
      billing_postal_code_snapshot: detail.billing_postal_code,
      billing_street_snapshot: detail.billing_street,
      billing_house_number_snapshot: detail.billing_house_number,
      billing_tax_number_snapshot: detail.billing_tax_number
    })
    .eq('id', saleResult.id)
    .eq('tenant_id', ctx.user.tenantId!)

  if (billErr) {
    console.error('convert quote billing → sale', billErr.message)
  }

  const { data, error } = await ctx.supabase.rpc('mark_sales_quote_converted', {
    p_quote_id: input.quoteId,
    p_sale_id: saleResult.id
  })

  if (error) {
    console.error('mark_sales_quote_converted', error.message)
    revalidateQuotePaths(input.quoteId, saleResult.id)
    return {
      ok: false,
      message:
        'Az eladás létrejött, de az ajánlat státuszát nem sikerült frissíteni. Nyisd meg az eladást.',
      saleId: saleResult.id
    }
  }

  const result = data as { ok?: boolean; message?: string } | null
  if (!result?.ok) {
    revalidateQuotePaths(input.quoteId, saleResult.id)
    return {
      ok: false,
      message:
        result?.message ??
        'Az eladás létrejött, de az ajánlat státuszát nem sikerült frissíteni. Nyisd meg az eladást.',
      saleId: saleResult.id
    }
  }

  revalidateQuotePaths(input.quoteId, saleResult.id)
  return { ok: true, id: input.quoteId, saleId: saleResult.id }
}

export async function cloneSalesQuoteAction(
  quoteId: string
): Promise<SalesQuoteActionResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const detail = await getSalesQuote(supabase, user.tenantId, quoteId)
  if (!detail) return { ok: false, message: 'Ajánlat nem található.' }

  const products = detail.items.filter(
    (i) =>
      i.item_kind === 'product' ||
      i.item_kind === 'sheet_material' ||
      i.item_kind === 'linear_material'
  )
  const fees = detail.items.filter((i) => i.item_kind === 'fee')

  const accessoryIds = products
    .filter((p) => p.item_kind === 'product' && p.accessory_id)
    .map((p) => p.accessory_id as string)
  const sheetIds = products
    .filter((p) => p.item_kind === 'sheet_material' && p.sheet_material_id)
    .map((p) => p.sheet_material_id as string)
  const linearIds = products
    .filter((p) => p.item_kind === 'linear_material' && p.linear_material_id)
    .map((p) => p.linear_material_id as string)

  const [accRes, sheetRes, linearRes] = await Promise.all([
    accessoryIds.length
      ? supabase
          .from('accessories')
          .select('id')
          .eq('tenant_id', user.tenantId)
          .is('deleted_at', null)
          .in('id', accessoryIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    sheetIds.length
      ? supabase
          .from('sheet_materials')
          .select('id')
          .eq('tenant_id', user.tenantId)
          .is('deleted_at', null)
          .in('id', sheetIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    linearIds.length
      ? supabase
          .from('linear_materials')
          .select('id')
          .eq('tenant_id', user.tenantId)
          .is('deleted_at', null)
          .in('id', linearIds)
      : Promise.resolve({ data: [] as { id: string }[] })
  ])

  const aliveAcc = new Set((accRes.data ?? []).map((r) => r.id))
  const aliveSheet = new Set((sheetRes.data ?? []).map((r) => r.id))
  const aliveLinear = new Set((linearRes.data ?? []).map((r) => r.id))

  const kept = products.filter((p) => {
    if (p.item_kind === 'product') return aliveAcc.has(p.accessory_id!)
    if (p.item_kind === 'sheet_material')
      return aliveSheet.has(p.sheet_material_id!)
    return aliveLinear.has(p.linear_material_id!)
  })
  const skipped = products.length - kept.length

  if (kept.length === 0) {
    return {
      ok: false,
      message:
        'A forrás tételei már nem elérhetők (törölt termék/anyag). Új ajánlatot kell készítened.'
    }
  }

  const created = await createSalesQuoteAction({
    warehouseId: detail.warehouse_id,
    customerId: detail.customer_id,
    note: detail.note,
    validUntil: null,
    discountPercentage: detail.discount_percentage,
    clonedFromId: detail.id,
    billing: {
      billingName: detail.billing_name,
      billingCountry: detail.billing_country,
      billingCity: detail.billing_city,
      billingPostalCode: detail.billing_postal_code,
      billingStreet: detail.billing_street,
      billingHouseNumber: detail.billing_house_number,
      billingTaxNumber: detail.billing_tax_number
    },
    items: kept.map((p) => {
      if (p.item_kind === 'sheet_material') {
        return {
          kind: 'sheet_material' as const,
          accessoryId: null,
          sheetMaterialId: p.sheet_material_id!,
          linearMaterialId: null,
          quantity: p.quantity,
          unitPriceGross: p.unit_price_gross,
          discountPercentage: p.discount_percentage
        }
      }
      if (p.item_kind === 'linear_material') {
        return {
          kind: 'linear_material' as const,
          accessoryId: null,
          sheetMaterialId: null,
          linearMaterialId: p.linear_material_id!,
          quantity: p.quantity,
          unitPriceGross: p.unit_price_gross,
          discountPercentage: p.discount_percentage
        }
      }
      return {
        kind: 'product' as const,
        accessoryId: p.accessory_id!,
        sheetMaterialId: null,
        linearMaterialId: null,
        quantity: p.quantity,
        unitPriceGross: p.unit_price_gross,
        discountPercentage: p.discount_percentage
      }
    }),
    fees: fees.map((f) => ({
      feeTypeId: f.fee_type_id,
      name: f.name_snapshot,
      quantity: f.quantity,
      unitPriceGross: f.unit_price_gross,
      taxRatePercent: f.tax_rate_percent
    }))
  })

  if (!created.ok) return created
  return { ...created, skippedLines: skipped }
}
