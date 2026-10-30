import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { A4SheetEditorClient } from '@/components/a4-barcode-sheets/a4-sheet-editor-client'
import { A4_PAGE_KEY } from '@/lib/a4-barcode-sheets/types'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új vonalkód lap'
}

export default async function UjVonalkodLapPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    redirect(A4_PAGE_KEY)
  }

  const supabase = await createClient()
  if (!supabase) redirect(A4_PAGE_KEY)

  const labelsOk = await tenantHasProductLabels(supabase, user.tenantId)
  if (!labelsOk) redirect(A4_PAGE_KEY)

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  if (!canWrite) redirect(A4_PAGE_KEY)

  return (
    <A4SheetEditorClient
      mode="create"
      initialName=""
      initialCols={3}
      initialRows={8}
      initialMarginMm={5}
      initialShowName={true}
      initialShowSku={true}
      initialShowPrice={true}
      initialCells={[]}
      canWrite={canWrite}
    />
  )
}
