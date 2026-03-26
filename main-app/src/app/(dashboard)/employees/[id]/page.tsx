import React from 'react'

import { notFound } from 'next/navigation'

import type { Metadata } from 'next'

import { getEmployeeById } from '@/lib/supabase-server'
import EmployeeEditClient from './EmployeeEditClient'

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
