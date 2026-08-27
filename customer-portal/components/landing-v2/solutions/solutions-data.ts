export type SolutionMockKind =
  | 'b2b-pricing'
  | 'orders'
  | 'cutlist'
  | 'footfall'
  | 'attendance'
  | 'custom'

export type HomeSolution = {
  id: string
  label: string
  mock: SolutionMockKind
  stage: 'teal' | 'orange' | 'indigo' | 'emerald' | 'sky' | 'violet'
}

export const HOME_SOLUTIONS: HomeSolution[] = [
  {
    id: 'b2b-portal',
    label: 'B2B partnerportál',
    mock: 'b2b-pricing',
    stage: 'teal',
  },
  {
    id: 'webshop-erp',
    label: 'Webshop ERP',
    mock: 'orders',
    stage: 'orange',
  },
  {
    id: 'asztalos-erp',
    label: 'Asztalos ERP',
    mock: 'cutlist',
    stage: 'indigo',
  },
  {
    id: 'vasarloszamlalo',
    label: 'Vásárlószámláló',
    mock: 'footfall',
    stage: 'emerald',
  },
  {
    id: 'munkaido',
    label: 'Munkaidő nyilvántartás',
    mock: 'attendance',
    stage: 'sky',
  },
  {
    id: 'egyedi',
    label: 'Egyedi fejlesztés',
    mock: 'custom',
    stage: 'violet',
  },
]

/** Full-bleed section band + mock wash + accent bar. */
export const STAGE_SURFACE: Record<
  HomeSolution['stage'],
  { band: string; wash: string; bar: string; border: string }
> = {
  teal: {
    band: 'bg-gradient-to-br from-teal-100 via-teal-50 to-cyan-100',
    wash: 'bg-teal-400/55',
    bar: 'bg-teal-600',
    border: 'border-teal-200/80',
  },
  orange: {
    band: 'bg-gradient-to-br from-orange-100 via-amber-50 to-orange-100',
    wash: 'bg-orange-400/50',
    bar: 'bg-orange-600',
    border: 'border-orange-200/80',
  },
  indigo: {
    band: 'bg-gradient-to-br from-indigo-100 via-violet-50 to-indigo-100',
    wash: 'bg-indigo-400/50',
    bar: 'bg-indigo-600',
    border: 'border-indigo-200/80',
  },
  emerald: {
    band: 'bg-gradient-to-br from-emerald-100 via-teal-50 to-emerald-100',
    wash: 'bg-emerald-400/50',
    bar: 'bg-emerald-600',
    border: 'border-emerald-200/80',
  },
  sky: {
    band: 'bg-gradient-to-br from-sky-100 via-cyan-50 to-sky-100',
    wash: 'bg-sky-400/50',
    bar: 'bg-sky-600',
    border: 'border-sky-200/80',
  },
  violet: {
    band: 'bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-100',
    wash: 'bg-violet-400/48',
    bar: 'bg-violet-600',
    border: 'border-violet-200/80',
  },
}
