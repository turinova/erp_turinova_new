/** Minimál light tokenek — Midday charcoal (modul-app 18 / 59). */
export const colors = {
  ink: '#18181B',
  inkSecondary: '#52525B',
  inkMuted: '#71717A',
  surface: '#FFFFFF',
  subtle: '#FAFAFA',
  /** Web `--bg-app` parity (login / shell) */
  app: '#F4F4F5',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  primary: '#18181B',
  onPrimary: '#FFFFFF',
  tabInactive: '#A1A1AA',
  chartBar: '#18181B',
  chartBarMuted: '#D4D4D8',
  /** Lapszabászat domain szín (web Opti csempe) — chartokon mindig ez = „ma / most”. */
  lapszab: '#2563EB',
  lapszabSoft: '#BFDBFE',
  /** Összehasonlító sor (tegnap / előző időszak) — mindig halvány szürke. */
  chartCompare: '#A1A1AA',
  /** Partnerportálról érkezett megrendelés (web Ajánlatok csempe). */
  portal: '#7C3AED',
  /** Belépők domain szín (web nav teal). */
  belepok: '#0D9488',
  belepokSoft: '#99F6E4',
  /** Jelenlét státuszok — mindig felirattal együtt. */
  presenceIn: '#16A34A',
  presenceLeft: '#71717A',
  presenceVacation: '#0EA5E9',
  presenceSick: '#A855F7',
  presenceNone: '#D4D4D8'
} as const

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32
} as const

export const radius = {
  sm: 6,
  md: 8,
  lg: 12
} as const

export const type = {
  kicker: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 20 },
  bodySm: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 20, fontWeight: '700' as const },
  hero: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -0.8 },
  metric: { fontSize: 22, fontWeight: '700' as const }
} as const
