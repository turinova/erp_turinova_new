import type { TenantStatus } from '@/lib/supabase/database.types'

export type OnboardingFlags = {
  company_profile_done: boolean
  first_login_at: string | null
  has_sheet_material: boolean
  has_edge_material: boolean
  has_quote: boolean
  has_order: boolean
}

export const ONBOARDING_STEPS: Array<{
  key: keyof OnboardingFlags
  label: string
}> = [
  { key: 'company_profile_done', label: 'Cégadatok' },
  { key: 'first_login_at', label: 'Első belépés' },
  { key: 'has_sheet_material', label: 'Táblás anyag' },
  { key: 'has_edge_material', label: 'Élzáró' },
  { key: 'has_quote', label: 'Árajánlat' },
  { key: 'has_order', label: 'Megrendelés' }
]

export function onboardingProgress(flags: OnboardingFlags | null): {
  done: number
  total: number
  percent: number
} {
  const total = ONBOARDING_STEPS.length
  if (!flags) return { done: 0, total, percent: 0 }

  let done = 0
  for (const step of ONBOARDING_STEPS) {
    const value = flags[step.key]
    if (step.key === 'first_login_at') {
      if (value) done += 1
    } else if (value === true) {
      done += 1
    }
  }
  return {
    done,
    total,
    percent: Math.round((done / total) * 100)
  }
}

export function onboardingNextStep(
  flags: OnboardingFlags | null
): string | null {
  if (!flags) return 'Indítsd el az onboardingot (Állapot frissítése).'
  for (const step of ONBOARDING_STEPS) {
    const value = flags[step.key]
    const done =
      step.key === 'first_login_at' ? Boolean(value) : value === true
    if (!done) {
      switch (step.key) {
        case 'first_login_at':
          return 'Az owner még nem lépett be — küldd el a belépési adatokat.'
        case 'company_profile_done':
          return 'Következő: Beállítások → Cégadatok kitöltése.'
        case 'has_sheet_material':
          return 'Következő: legalább egy táblás anyag felvétele.'
        case 'has_edge_material':
          return 'Következő: legalább egy élzáró felvétele.'
        case 'has_quote':
          return 'Következő: első árajánlat mentése (Opti).'
        case 'has_order':
          return 'Következő: árajánlat átalakítása megrendeléssé.'
        default:
          return `Következő: ${step.label}.`
      }
    }
  }
  return null
}

export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  provisioning: 'Beállítás alatt',
  active: 'Élő',
  read_only: 'Csak olvasás',
  suspended: 'Felfüggesztve',
  churned: 'Lezárva'
}

export function tenantStatusTone(
  status: TenantStatus
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success'
    case 'provisioning':
      return 'info'
    case 'read_only':
      return 'warning'
    case 'suspended':
    case 'churned':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function slugifyTenantName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
