import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { 
  getMaterialById, 
  getAllBrandsForMaterials,
  getAllCurrencies,
  getAllVatRates,
  getMaterialPriceHistory,
  getAllPartners,
  getAllUnits
} from '@/lib/supabase-server'
import MaterialsEditClient from './MaterialsEditClient'

interface Material {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  grain_direction: boolean
  on_stock: boolean
  image_url: string | null
  brand_id: string
  brand_name: string
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  rotatable: boolean
  waste_multi: number
  usage_limit: number
  machine_code: string
  base_price: number
  multiplier: number
  price_per_sqm: number
  partners_id: string | null
  units_id: string | null
  currency_id: string | null
  vat_id: string | null
  currencies?: { id: string; name: string } | null
  vat?: { id: string; name: string; kulcs: number } | null
  created_at: string
  updated_at: string
}

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface MaterialsEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: MaterialsEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const material = await getMaterialById(resolvedParams.id)
  
  return {
    title: material ? `Anyag - ${material.name}` : 'Anyag szerkesztése'
  }
}

// Server-side rendered materials edit page
export default async function MaterialsEditPage({ params }: MaterialsEditPageProps) {
  const resolvedParams = await params
  
  // Fetch all data on the server for SSR (prevents hydration issues)
  const [material, brands, currencies, vatRates, priceHistory, partners, units, inventorySummary, inventoryTransactions] = await Promise.all([
    getMaterialById(resolvedParams.id),
    getAllBrandsForMaterials(),
    getAllCurrencies(),
    getAllVatRates(),
    getMaterialPriceHistory(resolvedParams.id),
    getAllPartners(),
    getAllUnits(),
    // Fetch inventory summary
    (async () => {
      const { supabaseServer } = await import('@/lib/supabase-server')
      const { data } = await supabaseServer
        .from('material_inventory_summary')
        .select('*')
        .eq('material_id', resolvedParams.id)
        .single()
      return data
    })(),
    // Fetch inventory transactions with order_number
    (async () => {
      const { supabaseServer } = await import('@/lib/supabase-server')
      const { data } = await supabaseServer
        .from('material_inventory_transactions')
        .select('*')
        .eq('material_id', resolvedParams.id)
        .order('created_at', { ascending: false })
        .limit(100)
      
      // Enrich with order_number for shop_order_item references
      const enrichedData = await Promise.all((data || []).map(async (transaction: any) => {
        if (transaction.reference_type === 'shop_order_item') {
          const { data: itemData } = await supabaseServer
            .from('shop_order_items')
            .select('order_id, shop_orders!inner(order_number)')
            .eq('id', transaction.reference_id)
            .single()

          if (itemData) {
            return {
              ...transaction,
              order_number: (itemData.shop_orders as any)?.order_number || null
            }
          }
        }
        return {
          ...transaction,
          order_number: null
        }
      }))
      
      return enrichedData
    })()
  ])
  
  if (!material) {
    notFound()
  }

  // Pass pre-loaded data to client component
  return (
    <MaterialsEditClient 
      initialMaterial={material} 
      initialBrands={brands}
      initialCurrencies={currencies}
      initialVatRates={vatRates}
      initialPriceHistory={priceHistory}
      initialPartners={partners}
      initialUnits={units}
      initialInventorySummary={inventorySummary}
      initialInventoryTransactions={inventoryTransactions}
    />
  )
}