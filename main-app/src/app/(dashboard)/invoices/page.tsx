import React from 'react'
import type { Metadata } from 'next'
import { supabaseServer } from '@/lib/supabase-server'
import InvoicesClient from './InvoicesClient'

export const metadata: Metadata = {
  title: 'Kimenő számlák'
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    limit?: string
  }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  
  const offset = (page - 1) * limit

  try {
    // Build query
    let query = supabaseServer
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('provider', 'szamlazz_hu')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (searchTerm && searchTerm.trim().length >= 2) {
      const search = searchTerm.trim()
      // Search by invoice number, customer name, or customer_id (exact match for UUID)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search)
      if (isUuid) {
        // If search term looks like a UUID, search by customer_id exactly
        query = query.eq('customer_id', search)
      } else {
        // Otherwise search by invoice number or customer name
        query = query.or(
          `internal_number.ilike.%${search}%,provider_invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%`
        )
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching invoices:', error)
      return (
        <InvoicesClient 
          initialInvoices={[]}
          totalCount={0}
          totalPages={0}
          currentPage={1}
          initialSearchTerm={searchTerm}
          initialPageSize={limit}
        />
      )
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return (
      <InvoicesClient 
        initialInvoices={data || []}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        initialSearchTerm={searchTerm}
        initialPageSize={limit}
      />
    )
  } catch (error) {
    console.error('Error in InvoicesPage:', error)
    return (
      <InvoicesClient 
        initialInvoices={[]}
        totalCount={0}
        totalPages={0}
        currentPage={1}
        initialSearchTerm={searchTerm}
        initialPageSize={limit}
      />
    )
  }
}

