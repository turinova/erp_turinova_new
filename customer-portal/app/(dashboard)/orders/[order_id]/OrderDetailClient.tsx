'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import QuoteDetailClient from '../../quotes/[quote_id]/QuoteDetailClient'

// OrderDetailClient is a wrapper around QuoteDetailClient
// It passes isOrderView=true to show different buttons

interface OrderDetailClientProps {
  initialQuoteData: any
  feeTypes: any[]
  accessories: any[]
  vatRates: any[]
  currencies: any[]
  units: any[]
  partners: any[]
}

export default function OrderDetailClient(props: OrderDetailClientProps) {
  // For now, just render the same component
  // We'll add conditional logic in QuoteDetailClient based on status
  return <QuoteDetailClient {...props} isOrderView={true} />
}

