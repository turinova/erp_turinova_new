import React from 'react'
import { notFound } from 'next/navigation'
import { getPaymentMethodById } from '@/lib/supabase-server'
import PaymentMethodEditClient from './PaymentMethodEditClient'

interface PaymentMethod {
  id: string
  name: string
  comment: string | null
  active: boolean
  created_at: string
  updated_at: string
}

interface PaymentMethodEditPageProps {
  params: Promise<{ id: string }>
}

// Server-side rendered payment method edit page
export default async function PaymentMethodEditPage({ params }: PaymentMethodEditPageProps) {
  const resolvedParams = await params
  const paymentMethod = await getPaymentMethodById(resolvedParams.id)
  
  if (!paymentMethod) {
    notFound()
  }
  
  return <PaymentMethodEditClient initialPaymentMethod={paymentMethod} />
}

