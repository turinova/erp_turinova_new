import {
  defaultEdgeTypeId,
  edgeTypesForDuplung,
  KIOSK_EDGE_TYPES
} from '@/lib/kiosk/edge-types'
import type { MockEdge, MockSheet } from '@/lib/kiosk/types'

export { defaultEdgeTypeId, edgeTypesForDuplung }

/** UX mock — nem DB. Bármely `/k/[slug]` ugyanazt kapja. */
export const MOCK_TENANT_LABEL = 'Demó barkácsáruház'

/** Placeholder tenant logo (valós: tenant_companies.logo_url). */
export const MOCK_TENANT_LOGO_URL = '/images/hiros-logo.png'

export const TURINOVA_LOGO_URL = '/images/turinova-logo.png'

function sheet(
  partial: Omit<MockSheet, 'lengthMm' | 'widthMm' | 'grainDirection'> & {
    lengthMm?: number
    widthMm?: number
    grainDirection?: boolean
  }
): MockSheet {
  return {
    lengthMm: 2800,
    widthMm: 2070,
    grainDirection: false,
    ...partial
  }
}

/** ~24 raktári/rendelős lap — UX kereső + stock badge teszt. */
export const MOCK_SHEETS: MockSheet[] = [
  sheet({
    id: 's-white-18',
    name: 'Fehér egyszínű',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'W980 ST2',
    swatch: 'linear-gradient(145deg,#f8fafc,#e2e8f0)',
    pricePerSqmGross: 8900
  }),
  sheet({
    id: 's-white-28',
    name: 'Fehér egyszínű',
    thicknessMm: 28,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'W980 ST2-28',
    swatch: 'linear-gradient(145deg,#f1f5f9,#cbd5e1)',
    pricePerSqmGross: 14200
  }),
  sheet({
    id: 's-oak-18',
    name: 'Tölgy rustic',
    thicknessMm: 18,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'H1145 ST10',
    swatch: 'linear-gradient(145deg,#c4a574,#8b6914)',
    pricePerSqmGross: 12400
  }),
  sheet({
    id: 's-oak-light-18',
    name: 'Tölgy világos',
    thicknessMm: 18,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Kronospan',
    machineCode: 'K007 PW',
    swatch: 'linear-gradient(145deg,#e8d5b5,#c4a574)',
    pricePerSqmGross: 12100
  }),
  sheet({
    id: 's-anthracite-18',
    name: 'Antracit matt',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'U961 ST9',
    swatch: 'linear-gradient(145deg,#52525b,#27272a)',
    pricePerSqmGross: 11200
  }),
  sheet({
    id: 's-beech-18',
    name: 'Bükk természetes',
    thicknessMm: 18,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Kronospan',
    machineCode: 'K007 BU',
    swatch: 'linear-gradient(145deg,#e8c49a,#c9956c)',
    pricePerSqmGross: 11800
  }),
  sheet({
    id: 's-black-18',
    name: 'Fekete egyszínű',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'U999 ST2',
    swatch: 'linear-gradient(145deg,#3f3f46,#18181b)',
    pricePerSqmGross: 10500
  }),
  sheet({
    id: 's-concrete-18',
    name: 'Beton szürke',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'F186 ST9',
    swatch: 'linear-gradient(145deg,#a1a1aa,#71717a)',
    pricePerSqmGross: 11900
  }),
  sheet({
    id: 's-walnut-18',
    name: 'Dió sötét',
    thicknessMm: 18,
    grainDirection: true,
    onStock: false,
    manufacturerName: 'Egger',
    machineCode: 'H3734 ST9',
    swatch: 'linear-gradient(145deg,#7c4a2d,#4a2c1a)',
    pricePerSqmGross: 13200
  }),
  sheet({
    id: 's-ash-18',
    name: 'Kőris természetes',
    thicknessMm: 18,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Kronospan',
    machineCode: 'K018 AS',
    swatch: 'linear-gradient(145deg,#d6c3a8,#b59a7a)',
    pricePerSqmGross: 12600
  }),
  sheet({
    id: 's-grey-18',
    name: 'Szürke egyszínű',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'U708 ST9',
    swatch: 'linear-gradient(145deg,#d4d4d8,#a1a1aa)',
    pricePerSqmGross: 9200
  }),
  sheet({
    id: 's-cream-18',
    name: 'Krém egyszínű',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'W1100 ST9',
    swatch: 'linear-gradient(145deg,#faf6ef,#e8e0d0)',
    pricePerSqmGross: 9400
  }),
  sheet({
    id: 's-pine-18',
    name: 'Fenyő természetes',
    thicknessMm: 18,
    grainDirection: true,
    onStock: false,
    manufacturerName: 'Kronospan',
    machineCode: 'K122 PI',
    swatch: 'linear-gradient(145deg,#f0e0b8,#d4b87a)',
    pricePerSqmGross: 10800
  }),
  sheet({
    id: 's-wenge-18',
    name: 'Wenge',
    thicknessMm: 18,
    grainDirection: true,
    onStock: false,
    manufacturerName: 'Egger',
    machineCode: 'H1199 ST12',
    swatch: 'linear-gradient(145deg,#4a3728,#2a1c12)',
    pricePerSqmGross: 12800
  }),
  sheet({
    id: 's-oak-28',
    name: 'Tölgy rustic',
    thicknessMm: 28,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'H1145 ST10-28',
    swatch: 'linear-gradient(145deg,#b89560,#7a5a28)',
    pricePerSqmGross: 16800
  }),
  sheet({
    id: 's-anthracite-28',
    name: 'Antracit matt',
    thicknessMm: 28,
    onStock: false,
    manufacturerName: 'Egger',
    machineCode: 'U961 ST9-28',
    swatch: 'linear-gradient(145deg,#3f3f46,#18181b)',
    pricePerSqmGross: 15600
  }),
  sheet({
    id: 's-marble-18',
    name: 'Márvány fehér',
    thicknessMm: 18,
    onStock: false,
    manufacturerName: 'Cleaf',
    machineCode: 'CL-MAR-W',
    swatch: 'linear-gradient(145deg,#fafafa,#e5e5e5 40%,#d4d4d8)',
    pricePerSqmGross: 14500
  }),
  sheet({
    id: 's-slate-18',
    name: 'Pala antracit',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Cleaf',
    machineCode: 'CL-SLT-A',
    swatch: 'linear-gradient(145deg,#64748b,#334155)',
    pricePerSqmGross: 13800
  }),
  sheet({
    id: 's-cherry-18',
    name: 'Cseresznye',
    thicknessMm: 18,
    grainDirection: true,
    onStock: false,
    manufacturerName: 'Kronospan',
    machineCode: 'K055 CH',
    swatch: 'linear-gradient(145deg,#c47a5a,#8b4518)',
    pricePerSqmGross: 12900
  }),
  sheet({
    id: 's-bamboo-18',
    name: 'Bambusz világos',
    thicknessMm: 18,
    grainDirection: true,
    onStock: false,
    manufacturerName: 'Kronospan',
    machineCode: 'K201 BA',
    swatch: 'linear-gradient(145deg,#e8e0a8,#c8b86a)',
    pricePerSqmGross: 15200
  }),
  sheet({
    id: 's-graphite-18',
    name: 'Grafit egyszínű',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'U732 ST9',
    swatch: 'linear-gradient(145deg,#6b7280,#374151)',
    pricePerSqmGross: 9800
  }),
  sheet({
    id: 's-alabaster-18',
    name: 'Alabástrom fehér',
    thicknessMm: 18,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'W1000 ST9',
    swatch: 'linear-gradient(145deg,#fffcf5,#f0ebe0)',
    pricePerSqmGross: 10100
  }),
  sheet({
    id: 's-oak-honey-18',
    name: 'Tölgy méz',
    thicknessMm: 18,
    grainDirection: true,
    onStock: true,
    manufacturerName: 'Egger',
    machineCode: 'H3303 ST10',
    swatch: 'linear-gradient(145deg,#e0b060,#b8832e)',
    pricePerSqmGross: 12300
  }),
  sheet({
    id: 's-black-28',
    name: 'Fekete egyszínű',
    thicknessMm: 28,
    onStock: false,
    manufacturerName: 'Egger',
    machineCode: 'U999 ST2-28',
    swatch: 'linear-gradient(145deg,#27272a,#09090b)',
    pricePerSqmGross: 14800
  })
]

/** Mock Ft/m — csak UX; élesben edge_type_map → edge_materials.price_net. */
const MOCK_EDGE_PRICE: Record<string, number> = {
  'foil-04': 280,
  'abs-1': 420,
  'abs-2': 520,
  'abs-42-1': 680,
  'abs-42-2': 780
}

export const MOCK_EDGES: MockEdge[] = KIOSK_EDGE_TYPES.map((t) => ({
  id: t.id,
  name: t.name,
  shortLabel: t.shortLabel,
  color: t.color,
  pricePerMGross: MOCK_EDGE_PRICE[t.id] ?? 0,
  requiresDuplung: t.requiresDuplung
}))

export const MOCK_CUT_FEE_PER_M_GROSS = 350

export function formatHuf(gross: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0
  }).format(Math.round(gross))
}

export function formatSheetDims(s: {
  lengthMm: number
  widthMm: number
  thicknessMm: number
}): string {
  return `${s.lengthMm} × ${s.widthMm} × ${s.thicknessMm} mm`
}
