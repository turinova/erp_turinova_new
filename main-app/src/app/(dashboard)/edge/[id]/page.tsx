import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getEdgeMaterialById, getAllBrandsForEdgeMaterials, getAllVatRatesForEdgeMaterials } from '@/lib/supabase-server'
import EdgeMaterialEditClient from './EdgeMaterialEditClient'

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  active: boolean
  ráhagyás: number
  favourite_priority: number | null
  machine_code?: string
  created_at: string
  updated_at: string
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

interface EdgeMaterialEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EdgeMaterialEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const edgeMaterial = await getEdgeMaterialById(resolvedParams.id)
  
  return {
    title: edgeMaterial ? `Élzáró - ${edgeMaterial.decor}` : 'Élzáró szerkesztése'
  }
}

// Server-side rendered edge material edit page
export default async function EdgeMaterialEditPage({ params }: EdgeMaterialEditPageProps) {
  const resolvedParams = await params
  const edgeMaterial = await getEdgeMaterialById(resolvedParams.id)
  const brands = await getAllBrandsForEdgeMaterials()
  const vatRates = await getAllVatRatesForEdgeMaterials()

  if (!edgeMaterial) {
    notFound()
  }

  return (
    <EdgeMaterialEditClient 
      initialEdgeMaterial={edgeMaterial} 
      allBrands={brands} 
      allVatRates={vatRates} 
      initialMachineCode={edgeMaterial.machine_code || ''}
    />
  )
}