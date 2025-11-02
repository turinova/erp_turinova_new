// Component Imports
import LandingPageWrapper from '@views/front-pages/landing-page'
import FrontLayout from '@components/layout/front-pages'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

const LandingPage = async () => {
  // Vars
  const mode = await getServerMode()

  return (
    <FrontLayout>
      <LandingPageWrapper mode={mode} />
    </FrontLayout>
  )
}

export default LandingPage

