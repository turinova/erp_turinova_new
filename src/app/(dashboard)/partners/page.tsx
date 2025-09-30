// Next Imports
import type { Metadata } from 'next'

// Component Imports
import PartnersListClient from './PartnersListClient'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

export const metadata: Metadata = {
  title: 'Beszállítók',
  description: 'Beszállítók kezelése'
}

const PartnersPage = async () => {
  // Vars
  const mode = await getServerMode()

  return <PartnersListClient mode={mode} />
}

export default PartnersPage
