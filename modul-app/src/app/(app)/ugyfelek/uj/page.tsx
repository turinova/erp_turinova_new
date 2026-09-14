import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerForm } from '@/components/customers/customer-form'
import { getSessionUser } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Új ügyfél'
}

export default async function NewUgyfelPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')

  return <CustomerForm mode="create" canWrite={canWrite} />
}
