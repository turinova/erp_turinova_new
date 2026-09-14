import type { Metadata } from 'next'

import { EmptyMasterPage } from '@/components/patterns/empty-master-page'

export const metadata: Metadata = {
  title: 'Díj típusok'
}

export default function DijTipusokPage() {
  return (
    <EmptyMasterPage
      title="Díj típusok"
      sectionPath="Törzsadatok → Rendszer"
      entityLabel="díj típus"
    />
  )
}
