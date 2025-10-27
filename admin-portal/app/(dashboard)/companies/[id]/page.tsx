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
  
  let company
  try {
    company = await getCompanyById(resolvedParams.id)
  } catch (error) {
    console.error('[PAGE] Exception in getCompanyById:', error)
  }
  
  if (!company) {
    console.error('[PAGE] Company not found, showing error UI')
    // ALWAYS show error page, never call notFound()
    return (
      <div style={{ padding: '40px', fontFamily: 'monospace', backgroundColor: '#fff3cd', border: '3px solid #ffc107', minHeight: '100vh' }}>
        <h1 style={{ color: '#856404', fontSize: '32px', marginBottom: '20px' }}>⚠️ Company Not Found</h1>
        <p style={{ fontSize: '16px', marginBottom: '10px' }}><strong>Company ID:</strong> {resolvedParams.id}</p>
        <p style={{ fontSize: '16px', marginBottom: '10px' }}><strong>Environment:</strong> {process.env.VERCEL_ENV || 'local'}</p>
        <p style={{ fontSize: '16px', marginBottom: '20px' }}><strong>What this means:</strong> The database query returned null</p>
        <p style={{ fontSize: '14px', color: '#856404' }}>This page should display if getCompanyById returns null. If you see /home instead, there's a routing issue.</p>
        <script dangerouslySetInnerHTML={{
          __html: `
            console.error('❌ [BROWSER] Company not found!');
            console.error('❌ [BROWSER] Company ID: "${resolvedParams.id}");
            console.error('❌ [BROWSER] Database query returned null');
            console.error('❌ [BROWSER] Check if RLS is blocking or company does not exist');
          `
        }} />
      </div>
    )
  }
  
  console.log('[PAGE] Company loaded successfully:', company.name)
  return (
    <>
      <script dangerouslySetInnerHTML={{
        __html: `console.log('✅ [BROWSER] Company loaded: "${company.name.replace(/"/g, '\\"')}");`
      }} />
      <CompanyEditClient initialCompany={company} />
    </>
  )
}

