import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerForm } from '@/components/customers/customer-form'
import { getSessionUser } from '@/lib/auth/session'
import { getCustomer } from '@/lib/customers/queries'
import { customerTabTitle } from '@/lib/seo/tab-titles'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Ügyfél' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Ügyfél' }
  const label = await customerTabTitle(supabase, user.tenantId, id)
  return { title: label ?? 'Ügyfél' }
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
