import React from 'react'
import { notFound } from 'next/navigation'
import { getCustomerById } from '@/lib/supabase-server'
import CustomersEditClient from './CustomersEditClient'

interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  discount_percent: number
  sms_notification: boolean
  created_at: string
  updated_at: string
}

interface CustomersEditPageProps {
  params: Promise<{ id: string }>
}

// Server-side rendered customers edit page
export default async function CustomersEditPage({ params }: CustomersEditPageProps) {
  const resolvedParams = await params
  const customer = await getCustomerById(resolvedParams.id)
  
  if (!customer) {
    notFound()
  }
  
  return <CustomersEditClient initialCustomer={customer} />
}
