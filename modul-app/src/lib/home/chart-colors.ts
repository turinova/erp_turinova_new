/**
 * Home heti chart színek — erős hue-különbség (ügyvezetői glance).
 * Nem charcoal-skála; max ~6 gép / élanyag + Egyéb.
 */

export const HOME_MACHINE_COLORS = [
  '#2563EB', // blue
  '#EA580C', // orange
  '#16A34A', // green
  '#9333EA', // purple
  '#0891B2', // cyan
  '#C2410C' // red-orange
] as const

export const HOME_EDGE_COLORS = [
  '#0F766E', // teal
  '#B45309', // amber
  '#1D4ED8', // blue
  '#BE185D', // pink
  '#4D7C0F', // lime
  '#6B7280' // gray — Egyéb
] as const

export function homeMachineColor(index: number): string {
  return HOME_MACHINE_COLORS[index % HOME_MACHINE_COLORS.length]!
}

export function homeEdgeColor(name: string, index: number): string {
  if (name === 'Egyéb') return HOME_EDGE_COLORS[5]!
  return HOME_EDGE_COLORS[index % 5]!
}
