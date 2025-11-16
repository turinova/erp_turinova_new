import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase-server'
import ProductSuggestionFormClient from '../ProductSuggestionFormClient'
import { getAllVatRates, getAllCurrencies, getAllUnits, getAllPartners } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Termék javaslat részletei'
}

async function fetchSuggestion(id: string) {
  const { data, error } = await supabaseServer
    .from('product_suggestions')
    .select(`
      id,
      status,
      admin_note,
      created_at,
      raw_product_name,
      raw_sku,
      raw_base_price,
      raw_multiplier,
      raw_quantity,
      raw_units_id,
      raw_partner_id,
      raw_vat_id,
      raw_currency_id,
      units:raw_units_id(name, shortform),
      partners:raw_partner_id(name),
      vat:raw_vat_id(kulcs),
      currencies:raw_currency_id(name)
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export default async function ProductSuggestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [suggestion, vatRates, currencies, units, partners] = await Promise.all([
    fetchSuggestion(id),
    getAllVatRates(),
    getAllCurrencies(),
    getAllUnits(),
    getAllPartners()
  ])

  if (!suggestion) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Javaslat nem található</h2>
          <p className="text-red-600">A keresett javaslat nem létezik vagy törölve lett.</p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="p-6">Betöltés...</div>}>
      <ProductSuggestionFormClient
        initialData={suggestion}
        vatRates={vatRates}
        currencies={currencies}
        units={units}
        partners={partners}
      />
    </Suspense>
  )
}


