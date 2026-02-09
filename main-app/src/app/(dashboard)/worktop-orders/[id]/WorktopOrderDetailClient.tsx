'use client'

import React from 'react'
import WorktopQuoteDetailClient from '../../worktop-quotes/[id]/WorktopQuoteDetailClient'

// WorktopOrderDetailClient is a wrapper around WorktopQuoteDetailClient
// It passes the same props, and WorktopQuoteDetailClient determines isOrderView based on order_number

interface Machine {
  id: string
  machine_name: string
  comment: string | null
}

interface TenantCompany {
  id: string
  name: string
  country: string
  postal_code: string
  city: string
  address: string
  phone_number: string
  email: string
  website: string
  tax_number: string
  company_registration_number: string
  vat_id: string
}

interface WorktopQuoteData {
  id: string
  quote_number: string
  order_number?: string | null
  status: string
  customer_id: string
  discount_percent: number
  comment?: string | null
  payment_status?: string
  production_machine_id?: string | null
  production_date?: string | null
  barcode?: string | null
  total_net: number
  total_vat: number
  total_gross: number
  final_total_after_discount: number
  created_at: string
  updated_at: string
  customers: any
  payments?: any[]
  configs: any[]
  pricing: any[]
}

interface FeeType {
  id: string
  name: string
  net_price: number
  vat_percent: number
  gross_price: number
}

interface WorktopOrderDetailClientProps {
  initialQuoteData: WorktopQuoteData
  tenantCompany: TenantCompany | null
  machines: Machine[]
  feeTypes: FeeType[]
}

export default function WorktopOrderDetailClient(props: WorktopOrderDetailClientProps) {
  // For now, just render the same component
  // WorktopQuoteDetailClient will determine isOrderView based on order_number presence
  return <WorktopQuoteDetailClient {...props} />
}
