// Component Imports
import LandingPageWrapper from '@views/front-pages/landing-page'
import FrontLayout from '@components/layout/front-pages'
import { IntersectionProvider } from '@/contexts/intersectionContext'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

// Type Imports
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Turinova - ERP rendszer kisvállalkozásoknak',
  description: 'Vállalatirányítási szoftver kisvállalkozásokra optimalizálva'
}

const LandingPage = async () => {
  // Vars
  const mode = await getServerMode()

  return (
    <IntersectionProvider>
      <FrontLayout>
        <LandingPageWrapper mode={mode} />
      </FrontLayout>
    </IntersectionProvider>
  )
}

export default LandingPage
