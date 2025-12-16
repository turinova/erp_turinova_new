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
    invoiceType?: string
  }>
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams
  const page = parseInt(resolvedParams.page || '1', 10)
  const limit = parseInt(resolvedParams.limit || '50', 10)
  const searchTerm = resolvedParams.search || ''
  const invoiceTypeFilter = resolvedParams.invoiceType || ''
  
  const offset = (page - 1) * limit

  try {
    // Build query
    let query = supabaseServer
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('provider', 'szamlazz_hu')
      .order('created_at', { ascending: false })

    // Apply invoice type filter
    if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
      query = query.eq('invoice_type', invoiceTypeFilter)
    }

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
          initialInvoiceTypeFilter={invoiceTypeFilter}
          initialPageSize={limit}
          invoiceTypeCounts={{
            all: 0,
            szamla: 0,
            elolegszamla: 0,
            dijbekero: 0,
            sztorno: 0
          }}
        />
      )
    }

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // Fetch counts for each invoice type (without search filter, but with provider filter)
    const [szamlaCount, elolegszamlaCount, dijbekeroCount, sztornoCount] = await Promise.all([
      supabaseServer
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'szamlazz_hu')
        .eq('invoice_type', 'szamla')
        .then(({ count }) => count || 0),
      supabaseServer
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'szamlazz_hu')
        .eq('invoice_type', 'elolegszamla')
        .then(({ count }) => count || 0),
      supabaseServer
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'szamlazz_hu')
        .eq('invoice_type', 'dijbekero')
        .then(({ count }) => count || 0),
      supabaseServer
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'szamlazz_hu')
        .eq('invoice_type', 'sztorno')
        .then(({ count }) => count || 0)
    ])

    const allCount = await supabaseServer
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('provider', 'szamlazz_hu')
      .then(({ count }) => count || 0)

    return (
      <InvoicesClient 
        initialInvoices={data || []}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        initialSearchTerm={searchTerm}
        initialInvoiceTypeFilter={invoiceTypeFilter}
        initialPageSize={limit}
        invoiceTypeCounts={{
          all: allCount,
          szamla: szamlaCount,
          elolegszamla: elolegszamlaCount,
          dijbekero: dijbekeroCount,
          sztorno: sztornoCount
        }}
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
        initialInvoiceTypeFilter={invoiceTypeFilter}
        initialPageSize={limit}
        invoiceTypeCounts={{
          all: 0,
          szamla: 0,
          elolegszamla: 0,
          dijbekero: 0,
          sztorno: 0
        }}
      />
    )
  }
}

