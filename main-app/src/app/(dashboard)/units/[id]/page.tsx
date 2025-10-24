import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUnitById } from '@/lib/supabase-server'
import UnitsEditClient from './UnitsEditClient'

interface Unit {
  id: string
  name: string
  shortform: string
  created_at: string
  updated_at: string
}

interface UnitsEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: UnitsEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const unit = await getUnitById(resolvedParams.id)
  
  return {
    title: unit ? `Egység - ${unit.name}` : 'Egység'
  }
}

// Server-side rendered units edit page
export default async function UnitsEditPage({ params }: UnitsEditPageProps) {
  const resolvedParams = await params
  const unit = await getUnitById(resolvedParams.id)
  
  if (!unit) {
    notFound()
  }
  
  return <UnitsEditClient initialUnit={unit} />
}
