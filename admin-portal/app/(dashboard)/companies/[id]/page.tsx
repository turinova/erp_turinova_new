import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCompanyById } from '@/lib/supabase-server'
import CompanyEditClient from './CompanyEditClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    const company = await getCompanyById(resolvedParams.id)
    
    return {
      title: company ? `Cég - ${company.name}` : 'Cég'
    }
  } catch (error) {
    return {
      title: 'Cég'
    }
  }
}

// Server-side rendered Company edit page
export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const company = await getCompanyById(resolvedParams.id)
  
  if (!company) {
    notFound()
  }
  
  return <CompanyEditClient initialCompany={company} />
}

