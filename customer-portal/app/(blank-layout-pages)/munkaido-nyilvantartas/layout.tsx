import type { Metadata } from 'next'

import MarketingShell from '@/components/landing-v2/MarketingShell'

export const metadata: Metadata = {
  title: 'Turinova Jelenlétkezelő — Munkaidő nyilvántartás kioszkkal',
  description:
    'Valós idejű jelenlét, RFID/PIN kioszk, dashboard, havi áttekintés percre pontosan. 10–30 fős magyar cégeknek — számold ki, mennyit veszítesz a láthatatlan csúszáson.',
  keywords: [
    'munkaidő nyilvántartás',
    'jelenlét nyilvántartás',
    'RFID kártyás beléptetés',
    'PIN kódos beléptetés',
    'túlóra számítás',
    'munkaidő kioszk',
    'beléptető rendszer',
    'jelenlét szoftver Magyarország',
    'Raspberry Pi beléptetés',
    'bérszámfejtés előkészítés',
  ],
  alternates: {
    canonical: '/munkaido-nyilvantartas',
  },
  openGraph: {
    title: 'Turinova Jelenlétkezelő — Tudd meg percre pontosan, ki dolgozik MOST',
    description:
      'Valós idejű jelenlét, RFID/PIN kioszk, havi áttekintés, automatikus túlóra-számítás. 10–30 fős magyar cégeknek.',
    siteName: 'Turinova',
    locale: 'hu_HU',
    type: 'website',
  },
}

export default function MunkaidoNyilvantartasLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>
}
