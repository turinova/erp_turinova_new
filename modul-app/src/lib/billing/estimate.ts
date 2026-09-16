import type { SupabaseClient } from '@supabase/supabase-js'

export type BillingLineKind = 'plan' | 'addon' | 'usage'

export type BillingLine = {
  kind: BillingLineKind
  key: string
  label: string
  quantity: number
  unitPriceHuf: number
  amountHuf: number
  detail?: string
}

export type MonthlyBillEstimate = {
  year: number
  month: number
  currency: string
  lines: BillingLine[]
  fixedTotalHuf: number
  usageTotalHuf: number
  totalHuf: number
  smsCount: number
}

function utcMonthBounds(year: number, month: number): {
  start: string
  end: string
} {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()
  return { start, end }
}

export function currentUtcYearMonth(now = new Date()): {
  year: number
  month: number
} {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

export function formatHufAmount(amount: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(Math.round(amount))} Ft`
}

/** Összegző / hero — mindig nettó jelöléssel. */
export function formatHuf(amount: number): string {
  return `${formatHufAmount(amount)} nettó`
}

/**
 * Manuális számlázás becslés: plan + enabled add-onok listaára
 * + SMS usage (sent/delivered) × unit price.
 * Platform és tenant ugyanazt a libet használja — nincs self-serve.
 */
export async function estimateTenantMonthlyBill(
  supabase: SupabaseClient,
  tenantId: string,
  year?: number,
  month?: number
): Promise<MonthlyBillEstimate> {
  const ym = year && month ? { year, month } : currentUtcYearMonth()
  const { start, end } = utcMonthBounds(ym.year, ym.month)

  const [
    { data: tenant },
    { data: addonRows },
    { count: smsCount }
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select(
        'plan_id, product_plans ( id, key, name, price_monthly_huf, currency )'
      )
      .eq('id', tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_addons')
      .select(
        `
        addon_id,
        product_addons (
          id,
          key,
          name,
          price_monthly_huf,
          price_unit_huf,
          unit_key,
          currency,
          active
        )
      `
      )
      .eq('tenant_id', tenantId),
    supabase
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'delivered'])
      .gte('created_at', start)
      .lt('created_at', end)
  ])

  const lines: BillingLine[] = []
  let currency = 'HUF'

  const planRaw = tenant?.product_plans as
    | {
        id: string
        key: string
        name: string
        price_monthly_huf: number | null
        currency: string | null
      }
    | {
        id: string
        key: string
        name: string
        price_monthly_huf: number | null
        currency: string | null
      }[]
    | null
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw

  if (plan) {
    const price = Number(plan.price_monthly_huf) || 0
    currency = plan.currency || 'HUF'
    lines.push({
      kind: 'plan',
      key: plan.key,
      label: plan.name,
      quantity: 1,
      unitPriceHuf: price,
      amountHuf: price
    })
  }

  let smsUnitPrice: number | null = null

  for (const row of addonRows ?? []) {
    const addons = row.product_addons as
      | {
          id: string
          key: string
          name: string
          price_monthly_huf: number | null
          price_unit_huf: number | null
          unit_key: string | null
          currency: string | null
          active: boolean
        }
      | {
          id: string
          key: string
          name: string
          price_monthly_huf: number | null
          price_unit_huf: number | null
          unit_key: string | null
          currency: string | null
          active: boolean
        }[]
      | null
    const addon = Array.isArray(addons) ? addons[0] : addons
    if (!addon || addon.active === false) continue

    const monthly = Number(addon.price_monthly_huf) || 0
    if (monthly > 0 || !addon.unit_key) {
      lines.push({
        kind: 'addon',
        key: addon.key,
        label: addon.name,
        quantity: 1,
        unitPriceHuf: monthly,
        amountHuf: monthly
      })
    }

    if (addon.unit_key === 'sms_sent' && addon.price_unit_huf != null) {
      smsUnitPrice = Number(addon.price_unit_huf) || 0
    }
  }

  const count = smsCount ?? 0
  if (smsUnitPrice != null && count >= 0) {
    const amount = count * smsUnitPrice
    lines.push({
      kind: 'usage',
      key: 'sms_sent',
      label: 'Elküldött SMS-ek',
      quantity: count,
      unitPriceHuf: smsUnitPrice,
      amountHuf: amount,
      detail: `${count} db × ${formatHufAmount(smsUnitPrice)}`
    })
  }

  const fixedTotalHuf = lines
    .filter((l) => l.kind !== 'usage')
    .reduce((s, l) => s + l.amountHuf, 0)
  const usageTotalHuf = lines
    .filter((l) => l.kind === 'usage')
    .reduce((s, l) => s + l.amountHuf, 0)

  return {
    year: ym.year,
    month: ym.month,
    currency,
    lines,
    fixedTotalHuf,
    usageTotalHuf,
    totalHuf: fixedTotalHuf + usageTotalHuf,
    smsCount: count
  }
}
