import React, { Suspense } from 'react'
import type { Metadata } from 'next'
import { getProductionMachineById } from '@/lib/supabase-server'
import MachineFormClient from '../MachineFormClient'

interface ProductionMachine {
  id: string
  machine_name: string
  comment: string | null
  usage_limit_per_day: number
  created_at: string
  updated_at: string
}

interface MachineFormPageProps {
  params: Promise<{ id: string }>
}

// Loading skeleton component
function MachineFormSkeleton() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: MachineFormPageProps): Promise<Metadata> {
  const { id } = await params
  
  if (id === 'new') {
    return { title: 'Új gép' }
  }
  
  const machine = await getProductionMachineById(id)
  return {
    title: machine ? `Gép - ${machine.machine_name}` : 'Gép szerkesztése'
  }
}

// Server-side rendered machine form page
export default async function MachineFormPage({ params }: MachineFormPageProps) {
  const { id } = await params
  const isEdit = id !== 'new'
  
  let machine: ProductionMachine | null = null
  
  if (isEdit) {
    machine = await getProductionMachineById(id)
  }

  return (
    <Suspense fallback={<MachineFormSkeleton />}>
      <MachineFormClient initialMachine={machine} isEdit={isEdit} />
    </Suspense>
  )
}
