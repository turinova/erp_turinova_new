import React, { Suspense } from 'react'
import type { Metadata } from 'next'

import NettfrontSkuFormClient from '../NettfrontSkuFormClient'

export const metadata: Metadata = {
  title: 'Új Nettfront anyag'
}

export default function NettfrontSkuNewPage() {
  return (
    <Suspense fallback={<div className="p-6">Betöltés…</div>}>
      <NettfrontSkuFormClient initialSku={null} isEdit={false} />
    </Suspense>
  )
}
