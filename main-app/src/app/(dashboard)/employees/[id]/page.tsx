import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getEmployeeById } from '@/lib/supabase-server'
import EmployeeEditClient from './EmployeeEditClient'

interface Employee {
  id: string
  name: string
  employee_code: string
  rfid_card_id: string | null
  pin_code: string | null
  active: boolean
  lunch_break_start: string | null
  lunch_break_end: string | null
  works_on_saturday: boolean
  created_at: string
  updated_at: string
}

interface EmployeeEditPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EmployeeEditPageProps): Promise<Metadata> {
  const resolvedParams = await params
  const employee = await getEmployeeById(resolvedParams.id)
  
  return {
    title: employee ? `Kolléga - ${employee.name}` : 'Kolléga'
  }
}

// Server-side rendered employee edit page
export default async function EmployeeEditPage({ params }: EmployeeEditPageProps) {
  const resolvedParams = await params
  const employee = await getEmployeeById(resolvedParams.id)
  
  if (!employee) {
    notFound()
  }
  
  return <EmployeeEditClient initialEmployee={employee} />
}
