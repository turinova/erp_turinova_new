import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getAccessoryById, getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners, getStockMovementsByAccessory, getAccessoryCurrentStock } from '@/lib/supabase-server'
import AccessoryFormClient from '../AccessoryFormClient'

interface AccessoryFormData {
  id: string
  name: string
  sku: string
  barcode?: string | null
  base_price: number
  multiplier: number
  net_price: number
  vat_id: string
  currency_id: string
  units_id: string
  partners_id: string
  image_url?: string | null
}

// Loading skeleton component
function AccessoryFormSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const accessory = await getAccessoryById(id)
  
  return {
    title: accessory ? `Termék - ${accessory.name}` : 'Termék szerkesztése'
  }
}

// Server-side rendered edit accessory page
export default async function EditAccessoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const startTime = performance.now()

  // Fetch all required data on the server
  const [accessory, vatRates, currencies, units, partners, stockMovementsData, currentStock] = await Promise.all([
    getAccessoryById(id),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners(),
    getStockMovementsByAccessory(id, 1, 50), // Fetch first page with 50 items
    getAccessoryCurrentStock(id)
  ])

  const totalTime = performance.now()
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[PERF] Edit Accessory Page SSR: ${(totalTime - startTime).toFixed(2)}ms`)
  }

  if (!accessory) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Termék nem található</h2>
          <p className="text-red-600">A keresett termék nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  // Transform accessory data for the form
  const formData: AccessoryFormData = {
    id: accessory.id,
    name: accessory.name,
    sku: accessory.sku,
    barcode: accessory.barcode || null,
    base_price: accessory.base_price || 0,
    multiplier: accessory.multiplier || 1.38,
    net_price: accessory.net_price,
    vat_id: accessory.vat_id,
    currency_id: accessory.currency_id,
    units_id: accessory.units_id,
    partners_id: accessory.partners_id,
    image_url: accessory.image_url || null
  }

  // Pass pre-loaded data to client component with Suspense boundary
  return (
    <Suspense fallback={<AccessoryFormSkeleton />}>
      <AccessoryFormClient 
        initialData={formData}
        vatRates={vatRates}
        currencies={currencies}
        units={units}
        partners={partners}
        initialStockMovements={stockMovementsData.stockMovements}
        stockMovementsTotalCount={stockMovementsData.totalCount}
        stockMovementsTotalPages={stockMovementsData.totalPages}
        stockMovementsCurrentPage={stockMovementsData.currentPage}
        currentStock={currentStock}
      />
    </Suspense>
  )
}
