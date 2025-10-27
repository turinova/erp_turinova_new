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
  
  console.log('[PAGE] Loading company:', resolvedParams.id, 'ENV:', process.env.VERCEL_ENV || 'local')
  const company = await getCompanyById(resolvedParams.id)
  
  if (!company) {
    console.error('[PAGE] Company not found, returning error page')
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', backgroundColor: '#fff3cd', border: '3px solid #ffc107' }}>
        <h1 style={{ color: '#856404' }}>⚠️ Company Not Found</h1>
        <p><strong>Company ID:</strong> {resolvedParams.id}</p>
        <p><strong>Environment:</strong> {process.env.VERCEL_ENV || 'local'}</p>
        <p><strong>What this means:</strong> The database query returned null</p>
        <script dangerouslySetInnerHTML={{
          __html: `
            console.error('❌ [BROWSER] Company not found!');
            console.error('❌ [BROWSER] Company ID: ${resolvedParams.id}');
            console.error('❌ [BROWSER] Database query returned null');
            console.error('❌ [BROWSER] Check if company exists in database');
          `
        }} />
      </div>
    )
  }
  
  console.log('[PAGE] Company loaded successfully:', company.name)
  return (
    <>
      <script dangerouslySetInnerHTML={{
        __html: `console.log('✅ [BROWSER] Company loaded: ${company.name.replace(/'/g, "\\'")}');`
      }} />
      <CompanyEditClient initialCompany={company} />
    </>
  )
}

