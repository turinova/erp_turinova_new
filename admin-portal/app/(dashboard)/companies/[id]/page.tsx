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
    console.error('[generateMetadata] Error fetching company:', error)
    return {
      title: 'Cég'
    }
  }
}

// Server-side rendered Company edit page
export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  const timestamp = new Date().toISOString()
  const debugInfo = {
    timestamp,
    companyId: resolvedParams.id,
    env: process.env.VERCEL_ENV || 'local',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
  }
  
  console.log(`[${timestamp}] [CompanyEdit] ======== START ========`)
  console.log(`[${timestamp}] [CompanyEdit] Fetching company ID:`, resolvedParams.id)
  console.log(`[${timestamp}] [CompanyEdit] Environment:`, process.env.VERCEL_ENV || 'local')
  console.log(`[${timestamp}] [CompanyEdit] Supabase URL:`, process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...')
  
  // ALWAYS log to browser console - even before try/catch
  const browserDebugScript = `
    console.warn('🚀 [CompanyEdit] PAGE LOADED AT:', '${timestamp}');
    console.warn('🚀 [CompanyEdit] Company ID:', '${resolvedParams.id}');
    console.warn('🚀 [CompanyEdit] Environment:', '${process.env.VERCEL_ENV || 'local'}');
    console.warn('🚀 [CompanyEdit] If you see this but nothing else, the page component never rendered');
    window.__COMPANY_PAGE_DEBUG__ = ${JSON.stringify(debugInfo)};
  `
  
  try {
    console.log(`[${timestamp}] [CompanyEdit] Calling getCompanyById...`)
    const company = await getCompanyById(resolvedParams.id)
    console.log(`[${timestamp}] [CompanyEdit] getCompanyById returned:`, company ? `Company: ${company.name}` : 'NULL')
    
    if (!company) {
      console.log(`[${timestamp}] [CompanyEdit] ❌ Company not found, returning debug UI`)
      // Return a client component that logs to browser console
      return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
          <div style={{ backgroundColor: '#ffeb3b', padding: '10px', marginBottom: '20px', border: '2px solid #f57f17' }}>
            <strong>🐛 DEBUG MODE ACTIVE</strong> - This page rendered at {timestamp}
          </div>
          <h1 style={{ color: 'red' }}>🚨 Company Not Found</h1>
          <p><strong>Company ID:</strong> {resolvedParams.id}</p>
          <p><strong>Time:</strong> {timestamp}</p>
          <p><strong>Environment:</strong> {process.env.VERCEL_ENV || 'local'}</p>
          <script dangerouslySetInnerHTML={{ __html: browserDebugScript }} />
          <script dangerouslySetInnerHTML={{
            __html: `
              console.error('❌ [CompanyEdit Browser] Company not found!');
              console.error('❌ [CompanyEdit Browser] Company ID:', '${resolvedParams.id}');
              console.error('❌ [CompanyEdit Browser] This means getCompanyById returned null');
              console.error('❌ [CompanyEdit Browser] Check server logs above for database error details');
            `
          }} />
        </div>
      )
    }
    
    console.log(`[${timestamp}] [CompanyEdit] ✅ Company loaded successfully, rendering client component`)
    console.log(`[${timestamp}] [CompanyEdit] ======== END ========`)
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: browserDebugScript }} />
        <script dangerouslySetInnerHTML={{
          __html: `
            console.log('✅ [CompanyEdit Browser] Company loaded:', '${company.name?.replace(/'/g, "\\'")}');
            console.log('✅ [CompanyEdit Browser] Company ID:', '${company.id}');
          `
        }} />
        <div style={{ backgroundColor: '#4caf50', color: 'white', padding: '5px 10px', fontSize: '12px', position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }}>
          🐛 DEBUG: Loaded at {timestamp}
        </div>
        <CompanyEditClient initialCompany={company} />
      </>
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error(`[${timestamp}] [CompanyEdit] ❌❌❌ EXCEPTION CAUGHT:`, errorMessage)
    console.error(`[${timestamp}] [CompanyEdit] Stack:`, errorStack)
    console.error(`[${timestamp}] [CompanyEdit] Full error:`, error)
    
    // Return error details with browser console logging
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#fee' }}>
        <div style={{ backgroundColor: '#ff5722', color: 'white', padding: '10px', marginBottom: '20px' }}>
          <strong>🐛 DEBUG MODE ACTIVE - EXCEPTION CAUGHT</strong>
        </div>
        <h1 style={{ color: 'darkred' }}>💥 Error Loading Company</h1>
        <p><strong>Company ID:</strong> {resolvedParams.id}</p>
        <p><strong>Time:</strong> {timestamp}</p>
        <p><strong>Error:</strong> {errorMessage}</p>
        <details>
          <summary>Full Error Details</summary>
          <pre style={{ backgroundColor: '#fff', padding: '10px', overflow: 'auto' }}>
            {JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}
          </pre>
        </details>
        <script dangerouslySetInnerHTML={{ __html: browserDebugScript }} />
        <script dangerouslySetInnerHTML={{
          __html: `
            console.error('💥 [CompanyEdit Browser] Exception caught!');
            console.error('💥 [CompanyEdit Browser] Company ID:', '${resolvedParams.id}');
            console.error('💥 [CompanyEdit Browser] Error:', ${JSON.stringify(errorMessage)});
            console.error('💥 [CompanyEdit Browser] This is a fatal error - check server logs above');
          `
        }} />
      </div>
    )
  }
}

