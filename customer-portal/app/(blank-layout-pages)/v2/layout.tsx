import type { Metadata } from 'next'
import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Turinova — Webshop ERP ami automatizálja a munkádat',
  description:
    'Készletkezelés, automatikus Számlázz.hu számlázás, kiszállítás és AI termékleírások — egy helyen, webshop tulajdonosoknak. Shoprenter, ExpressOne, GLS, Foxpost integráció.',
  keywords: [
    'webshop ERP', 'e-commerce ERP', 'Shoprenter integráció', 'Számlázz.hu integráció',
    'készletkezelő szoftver', 'rendeléskezelés', 'AI termékleírás', 'ERP rendszer Magyarország',
  ],
  openGraph: {
    title: 'Turinova — Webshop ERP ami automatizálja a munkádat',
    description: 'Készletkezelés, automatikus számlázás, kiszállítás és AI termékleírások egy helyen.',
    siteName: 'Turinova',
    locale: 'hu_HU',
    type: 'website',
  },
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell>{children}</MarketingShell>
  )
}
