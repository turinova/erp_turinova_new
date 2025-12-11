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
  getAllUnits,
  getStockMovementsByMaterial,
  getMaterialCurrentStock,
  getAllAccessories,
  getMaterialAccessories
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
  active: boolean
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
  const [
    material, 
    brands, 
    currencies, 
    vatRates, 
    priceHistory, 
    partners, 
    units, 
    stockMovementsData, 
    currentStock,
    allAccessories,
    materialAccessories
  ] = await Promise.all([
    getMaterialById(resolvedParams.id),
    getAllBrandsForMaterials(),
    getAllCurrencies(),
    getAllVatRates(),
    getMaterialPriceHistory(resolvedParams.id),
    getAllPartners(),
    getAllUnits(),
    getStockMovementsByMaterial(resolvedParams.id, 1, 50), // Fetch first page with 50 items
    getMaterialCurrentStock(resolvedParams.id),
    getAllAccessories(),
    getMaterialAccessories(resolvedParams.id)
  ])
  
  if (!material) {
    notFound()
  }

  // Pass pre-loaded data to client component
  // Type assertion to handle Supabase join types
  const materialTyped = material as Material
  
  return (
    <MaterialsEditClient 
      initialMaterial={materialTyped} 
      initialBrands={brands}
      initialCurrencies={currencies}
      initialVatRates={vatRates}
      initialPriceHistory={priceHistory}
      initialPartners={partners}
      initialUnits={units}
      initialStockMovements={stockMovementsData.stockMovements}
      stockMovementsTotalCount={stockMovementsData.totalCount}
      stockMovementsTotalPages={stockMovementsData.totalPages}
      stockMovementsCurrentPage={stockMovementsData.currentPage}
      currentStock={currentStock}
      initialAccessories={allAccessories}
      initialMaterialAccessories={materialAccessories}
    />
  )
}