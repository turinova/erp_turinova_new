/**
 * Tenant Előfizetés — plan extras szűrés (nincs ár, nincs self-serve).
 * Forrás: docs/33, docs/46, plan-bundles.ts
 */

import {
  bundledAddonKeysForPlan,
  isPlanKey,
  type PlanKey
} from '@/lib/platform/plan-bundles'
import { WEBSHOP_ENABLED } from '@/lib/webshop/enabled'

export type SubscriptionExtra = {
  key: string
  name: string
}

const EXTRA_LABEL: Record<string, string> = {
  pda_pos: 'PDA',
  jelenlet: 'Jelenlét',
  footcounter: 'Belépőszámláló',
  lapszabaszat: 'Lapszabászat',
  partner_orders: 'Partner rendelések',
  quote_ready_sms: 'Kész értesítő SMS',
  webshop: 'Webshop'
}

export function normalizePlanKey(
  key: string | null | undefined
): PlanKey | null {
  if (!key) return null
  if (key === 'alap') return 'bolt'
  if (isPlanKey(key)) return key
  return null
}

export function extraDisplayName(key: string, fallback: string): string {
  return EXTRA_LABEL[key] ?? fallback
}

/** Tenant Előfizetés kártya — plain magyar, zsargon nélkül. */
export function tenantPlanBlurb(planKey: PlanKey | null): string {
  switch (planKey) {
    case 'bolt':
      return 'Pénztár, készlet, beszerzés, ügyfélrendelés és számla.'
    case 'bolt_plus':
      return 'A Bolt, plusz PDA, jelenlét és belépőszámláló.'
    case 'muhely':
      return 'A Bolt, plusz lapszabászat és partner rendelések.'
    case 'pro':
      return 'A Bolt+, plusz elsőbbségi segítség.'
    default:
      return 'A csomag tartalmát a support állítja be.'
  }
}

export function tenantPlanLabel(planKey: PlanKey): string {
  switch (planKey) {
    case 'bolt':
      return 'Bolt'
    case 'bolt_plus':
      return 'Bolt+'
    case 'muhely':
      return 'Műhely'
    case 'pro':
      return 'Pro'
  }
}

/**
 * Planen kívüli, bekapcsolt add-onok (à la carte).
 */
export function filterSubscriptionExtras(input: {
  planKey: PlanKey | null
  enabled: Array<{ key: string; name: string }>
}): SubscriptionExtra[] {
  const bundled = new Set(bundledAddonKeysForPlan(input.planKey))
  return input.enabled
    .filter((a) => {
      if (bundled.has(a.key)) return false
      if (a.key === 'webshop' && !WEBSHOP_ENABLED) return false
      if (a.key === 'pos' || a.key === 'product_labels' || a.key === 'beszerzes') {
        return false
      }
      return true
    })
    .map((a) => ({
      key: a.key,
      name: extraDisplayName(a.key, a.name)
    }))
}
