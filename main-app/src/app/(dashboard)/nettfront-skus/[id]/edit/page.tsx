import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getNettfrontSkuById } from '@/lib/supabase-server'

import NettfrontSkuFormClient from '../../NettfrontSkuFormClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const sku = await getNettfrontSkuById(id)
  return {
    title: sku ? `Nettfront - ${sku.display_name}` : 'Nettfront szerkesztése'
  }
}

export default async function NettfrontSkuEditPage({ params }: PageProps) {
  const { id } = await params
  const sku = await getNettfrontSkuById(id)

  if (!sku) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="p-6">Betöltés…</div>}>
      <NettfrontSkuFormClient
        initialSku={{
          id: sku.id,
          front_type: sku.front_type,
          sku_code: sku.sku_code,
          display_name: sku.display_name,
          finish: sku.finish,
          swatch_hex: sku.swatch_hex,
          cost_net_per_sqm: sku.cost_net_per_sqm,
          sell_net_per_sqm: sku.sell_net_per_sqm,
          is_active: sku.is_active,
          sort_order: sku.sort_order
        }}
        isEdit
      />
    </Suspense>
  )
}
