import React from 'react'
import type { Metadata } from 'next'
import SubscriptionPlanFormClient from '../SubscriptionPlanFormClient'

export const metadata: Metadata = {
  title: 'Új előfizetési terv - Turinova Admin'
}

export default function NewSubscriptionPlanPage() {
  return <SubscriptionPlanFormClient />
}
