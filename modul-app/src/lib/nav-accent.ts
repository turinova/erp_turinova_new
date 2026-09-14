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

/** Partner portál — meleg amber (nem staff charcoal klón). */
const AMBER: NavAccentClasses = {
  icon: 'text-amber-800',
  iconMuted: 'text-stone-500',
  soft: 'bg-amber-50',
  ink: 'text-amber-950',
  bar: 'bg-amber-700',
  ring: 'border-amber-200'
}

export const NAV_ACCENT_CLASSES: Record<NavAccent, NavAccentClasses> = {
  blue: SLATE,
  teal: SLATE,
  cyan: SLATE,
  violet: SLATE,
  amber: AMBER,
  rose: SLATE,
  emerald: SLATE,
  slate: SLATE
}

export function getNavAccentClasses(accent: NavAccent = 'slate'): NavAccentClasses {
  return NAV_ACCENT_CLASSES[accent] ?? SLATE
}
