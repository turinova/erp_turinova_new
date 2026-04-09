import type { Metadata } from 'next'

import FootcounterLiveClient from './FootcounterLiveClient'

export const metadata: Metadata = {
  title: 'Bejárat élő'
}

export default function FootcounterLivePage() {
  return <FootcounterLiveClient />
}
