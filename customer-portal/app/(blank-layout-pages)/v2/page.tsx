import Navbar from '@/components/landing-v2/Navbar'
import Hero from '@/components/landing-v2/Hero'
import CoreFeatures from '@/components/landing-v2/CoreFeatures'
import AIFeatures from '@/components/landing-v2/AIFeatures'
import Integrations from '@/components/landing-v2/Integrations'
import BottomCTA from '@/components/landing-v2/BottomCTA'

export default function LandingV2() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <CoreFeatures />
        <AIFeatures />
        <Integrations />
        <BottomCTA />
      </main>
    </>
  )
}
