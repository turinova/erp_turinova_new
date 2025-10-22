import LandingPage from '@views/LandingPage'
import { getMode } from '@core/utils/serverHelpers'

export default async function RootPage() {
  const mode = await getMode()
  
  return <LandingPage mode={mode} />
}
