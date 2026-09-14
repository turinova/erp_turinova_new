import type { Metadata } from 'next'

import { EmptyMasterPage } from '@/components/patterns/empty-master-page'

export const metadata: Metadata = {
  title: 'Egységek'
}

export default function EgysegekPage() {
  return (
    <EmptyMasterPage
      title="Egységek"
      sectionPath="Törzsadatok → Rendszer"
      entityLabel="egység"
    />
  )
}
