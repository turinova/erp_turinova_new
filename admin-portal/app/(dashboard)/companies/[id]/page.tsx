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

// TEST: Super simple page to verify routing works
export default async function CompanyEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  
  // IMMEDIATELY return simple HTML - no database, no logic
  return (
    <div style={{ padding: '40px', backgroundColor: '#4caf50', color: 'white', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>✅ PAGE IS WORKING!</h1>
      <p style={{ fontSize: '24px' }}>Company ID: {resolvedParams.id}</p>
      <p style={{ fontSize: '18px' }}>If you see this, the route works!</p>
      <script dangerouslySetInnerHTML={{
        __html: `
          console.log('🟢 [BROWSER] PAGE RENDERED!');
          console.log('🟢 [BROWSER] Company ID: "${resolvedParams.id}");
          console.log('🟢 [BROWSER] Route is working!');
        `
      }} />
    </div>
  )
}

