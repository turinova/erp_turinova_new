export type MarketingNavLink = {
  label: string
  href: string
  description?: string
  bullets?: string[]
}

export const MARKETING_SOLUTIONS: MarketingNavLink[] = [
  {
    label: 'Webshop ERP',
    href: '/v2',
    description: 'Rendelés–készlet–számlázás automatizálva.',
    bullets: ['Multi-webshop rendelések', 'Valós készlet', 'Integrációk + AI tartalom'],
  },
  {
    label: 'Vásárlószámláló (Footcounter)',
    href: '/vasarloszamlalo',
    description: 'Forgalom → konverzió → jobb döntések.',
    bullets: ['Hardver telepítés', 'Dashboard & trendek', 'Kampány-hatás mérés'],
  },
  {
    label: 'Munkaidő nyilvántartás (Attendance)',
    href: '/munkaido-nyilvantartas',
    description: 'Munkaidő és jelenlét rendben, viták nélkül.',
    bullets: ['Műszakok & jelenlét', 'Riportok & export', 'Eszközös opciók'],
  },
  {
    label: 'Asztalos ERP',
    href: '/asztalos-erp',
    description: 'Árajánlat → gyártás → átadás egyben.',
    bullets: ['Ajánlat és munkalap', 'Gyártásba adás', 'Fizetések követése'],
  },
  {
    label: 'Egyedi fejlesztés',
    href: '/egyedi-fejlesztes',
    description: 'Integrációk és folyamatok a te működésedre.',
    bullets: ['Rendszerösszekötés', 'Egyedi workflow', 'Migráció & automatizmus'],
  },
]

export const MARKETING_TOP_LINKS: { label: string; href: string }[] = [
  { label: 'Referenciák', href: '/referenciak' },
  { label: 'Árak', href: '/arak' },
]

export const MARKETING_COMPANY_LINKS: { label: string; href: string }[] = [
  { label: 'Rólunk', href: '/rolunk' },
  { label: 'Kapcsolat', href: '/kapcsolat' },
]

