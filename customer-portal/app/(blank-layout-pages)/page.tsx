import type { Metadata } from 'next'
import MarketingShell from '@/components/landing-v2/MarketingShell'
import Hero from '@/components/landing-v2/Hero'
import SolutionsStack from '@/components/landing-v2/solutions/SolutionsStack'
import BottomCTA from '@/components/landing-v2/BottomCTA'

export const metadata: Metadata = {
  title: 'Turinova',
  description:
    'Turinova: nagyker árak, webshop ERP, lapszabászat. Kapcsolat: info@turinova.hu',
}

export default async function MainLandingPage() {
  return (
    <MarketingShell>
      <main>
        <Hero />
        <SolutionsStack />
        <BottomCTA />
      </main>
    </MarketingShell>
  )
}
