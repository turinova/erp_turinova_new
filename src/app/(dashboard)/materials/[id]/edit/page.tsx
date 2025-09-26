import React from 'react'
import { notFound } from 'next/navigation'
import { getMaterialById, getAllBrandsForMaterials } from '@/lib/supabase-server'
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
  machine_code: string
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

// Server-side rendered materials edit page
export default async function MaterialsEditPage({ params }: MaterialsEditPageProps) {
  const resolvedParams = await params
  
  // Fetch material and brands data on the server
  const [material, brands] = await Promise.all([
    getMaterialById(resolvedParams.id),
    getAllBrandsForMaterials()
  ])
  
  if (!material) {
    notFound()
  }

  // Pass pre-loaded data to client component
  return <MaterialsEditClient initialMaterial={material} initialBrands={brands} />
}