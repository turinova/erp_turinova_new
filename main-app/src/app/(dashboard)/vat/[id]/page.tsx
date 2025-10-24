import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVatById } from '@/lib/supabase-server'
import VATEditClient from './VATEditClient'

interface VatRate {
  id: string
  name: string
  kulcs: number
  created_at: string
  updated_at: string
}

interface VATEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: VATEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const vatRate = await getVatById(resolvedParams.id)
  
  return {
    title: vatRate ? `Adónem - ${vatRate.name}` : 'Adónem'
  }
}

// Server-side rendered VAT edit page
export default async function VATEditPage({ params }: VATEditPageProps) {
  const resolvedParams = await params
  const vatRate = await getVatById(resolvedParams.id)
  
  if (!vatRate) {
    notFound()
  }
  
  return <VATEditClient initialVatRate={vatRate} />
}
