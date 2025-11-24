import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLinearMaterialById, getAllBrandsForLinearMaterials, getAllVatRatesForLinearMaterials, getAllCurrenciesForLinearMaterials, getAllPartners, getAllUnits, getStockMovementsByLinearMaterial, getLinearMaterialCurrentStock } from '@/lib/supabase-server'
import { supabaseServer } from '@/lib/supabase-server'
import LinearMaterialEditClient from './LinearMaterialEditClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const linearMaterial = await getLinearMaterialById(id)
  
  return {
    title: linearMaterial ? `Szálas anyag - ${linearMaterial.name}` : 'Szálas anyag szerkesztése'
  }
}

export default async function LinearMaterialEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const linearMaterial = await getLinearMaterialById(id)
  if (!linearMaterial) {
    notFound()
  }

  const [brands, vatRates, currencies, partners, units, stockMovementsData, currentStock] = await Promise.all([
    getAllBrandsForLinearMaterials(),
    getAllVatRatesForLinearMaterials(),
    getAllCurrenciesForLinearMaterials(),
    getAllPartners(),
    getAllUnits(),
    getStockMovementsByLinearMaterial(id, 1, 50), // Fetch first page with 50 items
    getLinearMaterialCurrentStock(id)
  ])

  // Fetch price history (last 10)
  const { data: priceHistory, error: historyError } = await supabaseServer
    .from('linear_material_price_history')
    .select(`
      id,
      old_price,
      new_price,
      changed_at,
      changed_by,
      old_currency_id,
      new_currency_id,
      old_vat_id,
      new_vat_id
    `)
    .eq('linear_material_id', id)
    .order('changed_at', { ascending: false })
    .limit(10)

  if (historyError) {
    console.error('Error fetching price history:', historyError)
  } else {
    console.log(`[LINEAR MATERIALS] Price history for ${id}:`, priceHistory?.length || 0, 'entries')
  }
  
  // Manually fetch currency and vat names for each history entry
  const enrichedHistory = await Promise.all((priceHistory || []).map(async (h: any) => {
    const [oldCurr, newCurr, oldVat, newVat] = await Promise.all([
      h.old_currency_id ? supabaseServer.from('currencies').select('name').eq('id', h.old_currency_id).single() : { data: null },
      h.new_currency_id ? supabaseServer.from('currencies').select('name').eq('id', h.new_currency_id).single() : { data: null },
      h.old_vat_id ? supabaseServer.from('vat').select('kulcs').eq('id', h.old_vat_id).single() : { data: null },
      h.new_vat_id ? supabaseServer.from('vat').select('kulcs').eq('id', h.new_vat_id).single() : { data: null }
    ])
    
    // Fetch user email using admin API
    let userEmail = null
    if (h.changed_by) {
      try {
        const { data: userData, error: userError } = await supabaseServer.auth.admin.getUserById(h.changed_by)
        if (userData?.user) {
          userEmail = userData.user.email
        }
      } catch (err) {
        console.error('Error fetching user:', err)
      }
    }
    
    return {
      ...h,
      old_currency: oldCurr.data,
      new_currency: newCurr.data,
      old_vat: oldVat.data,
      new_vat: newVat.data,
      changed_by_user: userEmail ? { email: userEmail } : null
    }
  }))

  return (
    <LinearMaterialEditClient
      initialLinearMaterial={linearMaterial}
      brands={brands}
      vatRates={vatRates}
      currencies={currencies}
      partners={partners}
      units={units}
      priceHistory={enrichedHistory}
      initialStockMovements={stockMovementsData.stockMovements}
      stockMovementsTotalCount={stockMovementsData.totalCount}
      stockMovementsTotalPages={stockMovementsData.totalPages}
      stockMovementsCurrentPage={stockMovementsData.currentPage}
      currentStock={currentStock}
    />
  )
}

