import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSubscriptionPlanById } from '@/lib/supabase-server'
import SubscriptionPlanFormClient from '../SubscriptionPlanFormClient'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    const plan = await getSubscriptionPlanById(resolvedParams.id)
    
    return {
      title: plan ? `Előfizetési terv - ${plan.name}` : 'Előfizetési terv'
    }
  } catch (error) {
    return {
      title: 'Előfizetési terv'
    }
  }
}

export default async function EditSubscriptionPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const plan = await getSubscriptionPlanById(resolvedParams.id)

  if (!plan) {
    notFound()
  }

  return <SubscriptionPlanFormClient initialPlan={plan} />
}
