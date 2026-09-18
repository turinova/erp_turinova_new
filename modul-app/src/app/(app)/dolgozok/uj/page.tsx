import type { Metadata } from 'next'

import { EmployeeFormClient } from '@/components/jelenlet/employee-form-client'
import { getSessionUser } from '@/lib/auth/session'
import { listEmployeeTypeOptions } from '@/lib/jelenlet/employee-types-queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Új dolgozó' }

export default async function UjDolgozoPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let typeOptions: Array<{ id: string; name: string; isDefault: boolean }> = []
  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        typeOptions = await listEmployeeTypeOptions(supabase, user.tenantId)
      } catch {
        typeOptions = []
      }
    }
  }

  return (
    <EmployeeFormClient canWrite={canWrite} typeOptions={typeOptions} />
  )
}
