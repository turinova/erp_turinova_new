import type { Metadata } from 'next'
import MarketingShell from '@/components/landing-v2/MarketingShell'
import Hero from '@/components/landing-v2/Hero'

export const metadata: Metadata = {
  title: 'Turinova — Szoftver megoldások magyar cégeknek',
  description:
    'Webshop ERP, vásárlószámláló (footcounter), munkaidő nyilvántartás és iparági ERP megoldások — találkozó egyeztetéssel.',
}

export default async function MainLandingPage() {
  return (
    <MarketingShell>
      <main>
        <Hero />
      </main>
    </MarketingShell>
  )
}
