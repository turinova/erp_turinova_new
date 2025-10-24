import React from 'react'
import type { Metadata } from 'next'
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

export async function generateMetadata({ params }: PaymentMethodEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const paymentMethod = await getPaymentMethodById(resolvedParams.id)
  
  return {
    title: paymentMethod ? `Fizetési mód - ${paymentMethod.name}` : 'Fizetési mód'
  }
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

