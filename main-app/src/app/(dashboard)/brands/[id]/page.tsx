import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getBrandById } from '@/lib/supabase-server'
import BrandDetailClient from './BrandDetailClient'

interface Brand {
  id: string
  name: string
  comment: string | null
  created_at: string
  updated_at: string
}

interface BrandDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const brand = await getBrandById(resolvedParams.id)
  
  return {
    title: brand ? `Gyártó - ${brand.name}` : 'Gyártó'
  }
}

// Server-side rendered brand detail page
export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const resolvedParams = await params
  
  // Fetch brand data on the server
  const brand = await getBrandById(resolvedParams.id)
  
  if (!brand) {
    notFound()
  }

  // Pass pre-loaded data to client component
  return <BrandDetailClient initialBrand={brand} />
}
