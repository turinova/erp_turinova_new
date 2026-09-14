/**
 * Nav accent — monokróm (Midday/Linear mintázat).
 * A hue kulcsok megmaradnak API-kompatibilitásért, mind slate-re mapelődik.
 */
export type NavAccent =
  | 'blue'
  | 'teal'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'slate'

export type NavAccentClasses = {
  icon: string
  iconMuted: string
  soft: string
  ink: string
  bar: string
  ring: string
}

const SLATE: NavAccentClasses = {
  icon: 'text-nav-slate-ink',
  iconMuted: 'text-ink-secondary',
  soft: 'bg-subtle',
  ink: 'text-ink',
  bar: 'bg-primary',
  ring: 'border-border-strong'
}

export const NAV_ACCENT_CLASSES: Record<NavAccent, NavAccentClasses> = {
  blue: SLATE,
  teal: SLATE,
  cyan: SLATE,
  violet: SLATE,
  amber: SLATE,
  rose: SLATE,
  emerald: SLATE,
  slate: SLATE
}

export function getNavAccentClasses(accent: NavAccent = 'slate'): NavAccentClasses {
  void accent
  return SLATE
}
