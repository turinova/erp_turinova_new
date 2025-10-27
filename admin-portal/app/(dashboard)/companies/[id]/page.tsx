import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCompanyById } from '@/lib/supabase-server'
import CompanyEditClient from './CompanyEditClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const company = await getCompanyById(resolvedParams.id)
  
  return {
    title: company ? `Cég - ${company.name}` : 'Cég'
  }
}

// Server-side rendered Company edit page
export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  console.log('[CompanyEdit] Fetching company:', resolvedParams.id)
  
  try {
    const company = await getCompanyById(resolvedParams.id)
    
    if (!company) {
      console.log('[CompanyEdit] Company not found:', resolvedParams.id)
      notFound()
    }
    
    console.log('[CompanyEdit] Company loaded:', company.name)
    return <CompanyEditClient initialCompany={company} />
  } catch (error) {
    console.error('[CompanyEdit] Error loading company:', error)
    throw error
  }
}

