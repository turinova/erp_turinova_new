import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerForm } from '@/components/customers/customer-form'
import { getSessionUser } from '@/lib/auth/session'
import { getCustomer } from '@/lib/customers/queries'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Ügyfél · ${id.slice(0, 8)}` }
}

export default async function EditUgyfelPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const customer = await getCustomer(supabase, user.tenantId, id)
  if (!customer) notFound()

  return (
    <CustomerForm mode="edit" initial={customer} canWrite={canWrite} />
  )
}
