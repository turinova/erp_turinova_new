/**
 * Nav accent — domain tint (ERP findability).
 * Idle: muted hue az ikonon; label neutrális.
 * Aktív: soft háttér + ink + bal sáv ugyanabból a hue-ból.
 * Nincs idle soft háttér, nincs leaf-rainbow.
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
  iconMuted: 'text-nav-slate',
  soft: 'bg-nav-slate-soft',
  ink: 'text-nav-slate-ink',
  bar: 'bg-nav-slate-ink',
  ring: 'border-border-strong'
}

const BLUE: NavAccentClasses = {
  icon: 'text-nav-blue-ink',
  iconMuted: 'text-nav-blue',
  soft: 'bg-nav-blue-soft',
  ink: 'text-nav-blue-ink',
  bar: 'bg-nav-blue',
  ring: 'border-nav-blue/30'
}

const TEAL: NavAccentClasses = {
  icon: 'text-nav-teal-ink',
  iconMuted: 'text-nav-teal',
  soft: 'bg-nav-teal-soft',
  ink: 'text-nav-teal-ink',
  bar: 'bg-nav-teal',
  ring: 'border-nav-teal/30'
}

const CYAN: NavAccentClasses = {
  icon: 'text-nav-cyan-ink',
  iconMuted: 'text-nav-cyan',
  soft: 'bg-nav-cyan-soft',
  ink: 'text-nav-cyan-ink',
  bar: 'bg-nav-cyan',
  ring: 'border-nav-cyan/30'
}

const VIOLET: NavAccentClasses = {
  icon: 'text-nav-violet-ink',
  iconMuted: 'text-nav-violet',
  soft: 'bg-nav-violet-soft',
  ink: 'text-nav-violet-ink',
  bar: 'bg-nav-violet',
  ring: 'border-nav-violet/30'
}

const AMBER: NavAccentClasses = {
  icon: 'text-nav-amber-ink',
  iconMuted: 'text-nav-amber',
  soft: 'bg-nav-amber-soft',
  ink: 'text-nav-amber-ink',
  bar: 'bg-nav-amber',
  ring: 'border-nav-amber/30'
}

const ROSE: NavAccentClasses = {
  icon: 'text-nav-rose-ink',
  iconMuted: 'text-nav-rose',
  soft: 'bg-nav-rose-soft',
  ink: 'text-nav-rose-ink',
  bar: 'bg-nav-rose',
  ring: 'border-nav-rose/30'
}

const EMERALD: NavAccentClasses = {
  icon: 'text-nav-emerald-ink',
  iconMuted: 'text-nav-emerald',
  soft: 'bg-nav-emerald-soft',
  ink: 'text-nav-emerald-ink',
  bar: 'bg-nav-emerald',
  ring: 'border-nav-emerald/30'
}

export const NAV_ACCENT_CLASSES: Record<NavAccent, NavAccentClasses> = {
  blue: BLUE,
  teal: TEAL,
  cyan: CYAN,
  violet: VIOLET,
  amber: AMBER,
  rose: ROSE,
  emerald: EMERALD,
  slate: SLATE
}

export function getNavAccentClasses(accent: NavAccent = 'slate'): NavAccentClasses {
  return NAV_ACCENT_CLASSES[accent] ?? SLATE
}
