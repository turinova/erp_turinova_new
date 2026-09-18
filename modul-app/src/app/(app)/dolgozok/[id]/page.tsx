import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EmployeeDetailClient } from '@/components/jelenlet/employee-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { listEmployeeTypeOptions } from '@/lib/jelenlet/employee-types-queries'
import { getEmployee, listAbsences } from '@/lib/jelenlet/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dolgozó' }

type Params = Promise<{ id: string }>

export default async function DolgozoDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <p className="text-body text-ink-secondary">
        Dev bypass vagy hiányzó tenant — nincs adatbázis.
      </p>
    )
  }

  const supabase = await createClient()
  if (!supabase) notFound()

  const [employee, absences] = await Promise.all([
    getEmployee(supabase, user.tenantId, id),
    listAbsences(supabase, user.tenantId, id)
  ])
  if (!employee) notFound()

  const typeOptions = await listEmployeeTypeOptions(supabase, user.tenantId, {
    includeId: employee.employeeTypeId
  })

  return (
    <EmployeeDetailClient
      employee={employee}
      absences={absences}
      canWrite={canWrite}
      typeOptions={typeOptions}
    />
  )
}
