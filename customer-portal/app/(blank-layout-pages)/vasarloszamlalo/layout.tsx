import type { Metadata } from 'next'

import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Turinova Vendégszámláló — Bolti forgalomelemző és konverzió mérés',
  description:
    'Diszkrét szenzor a bejárat felett, valós idejű dashboard, havi forgalom egy kattintásra. Kiskereskedőknek. Számold ki, mennyit ér +1% konverzió növekedés.',
  keywords: [
    'vásárlószámláló',
    'vendégszámláló',
    'bolti forgalomszámláló',
    'footcounter',
    'bolti analitika',
    'konverziós ráta',
    'kiskereskedelem',
    'bejárati szenzor',
    'forgalom mérés',
    'csúcsidő elemzés',
    'Turinova Vendégszámláló',
  ],
  alternates: {
    canonical: '/vasarloszamlalo',
  },
  openGraph: {
    title: 'Turinova Vendégszámláló — Tudd meg, hányan lépnek be, és mikor',
    description:
      'Diszkrét AI szenzor, valós idejű dashboard, 7 napos hőtérkép. Kiskereskedelemnek Magyarországon.',
    siteName: 'Turinova',
    locale: 'hu_HU',
    type: 'website',
  },
}

export default function VasarloszamlaloLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>
}
