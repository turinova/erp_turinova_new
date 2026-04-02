import Hero from '@/components/landing-v2/Hero'
import CoreFeatures from '@/components/landing-v2/CoreFeatures'
import AIFeatures from '@/components/landing-v2/AIFeatures'
import Integrations from '@/components/landing-v2/Integrations'
import GyikSection from '@/components/landing-v2/GyikSection'
import BottomCTA from '@/components/landing-v2/BottomCTA'

export default function LandingV2() {
  return (
    <main>
      <Hero />
      <CoreFeatures />
      <AIFeatures />
      <Integrations />
      <GyikSection />
      <BottomCTA />
    </main>
  )
}
