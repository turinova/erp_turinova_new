import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTenantById } from '@/lib/supabase-server'
import TenantDetailClient from './TenantDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    const tenant = await getTenantById(resolvedParams.id)
    
    return {
      title: tenant ? `Ügyfél - ${tenant.name}` : 'Ügyfél'
    }
  } catch (error) {
    return {
      title: 'Ügyfél'
    }
  }
}

// Server-side rendered Tenant detail page
export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const tenant = await getTenantById(resolvedParams.id)

  if (!tenant) {
    notFound()
  }

  return <TenantDetailClient initialTenant={tenant} />
}
