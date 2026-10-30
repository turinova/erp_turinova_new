import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { A4SheetEditorClient } from '@/components/a4-barcode-sheets/a4-sheet-editor-client'
import { getA4BarcodeSheet } from '@/lib/a4-barcode-sheets/queries'
import { A4_PAGE_KEY } from '@/lib/a4-barcode-sheets/types'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Vonalkód lap'
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function VonalkodLapDetailPage({ params }: PageProps) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    redirect(A4_PAGE_KEY)
  }

  const supabase = await createClient()
  if (!supabase) redirect(A4_PAGE_KEY)

  const labelsOk = await tenantHasProductLabels(supabase, user.tenantId)
  if (!labelsOk) redirect(A4_PAGE_KEY)

  let sheet: Awaited<ReturnType<typeof getA4BarcodeSheet>> = null
  try {
    sheet = await getA4BarcodeSheet(supabase, user.tenantId, id)
  } catch {
    redirect(A4_PAGE_KEY)
  }
  if (!sheet) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')

  return (
    <A4SheetEditorClient
      mode="edit"
      sheetId={sheet.id}
      initialName={sheet.name}
      initialCols={sheet.cols}
      initialRows={sheet.rows}
      initialMarginMm={sheet.margin_mm}
      initialShowName={sheet.show_name}
      initialShowSku={sheet.show_sku}
      initialShowPrice={sheet.show_price}
      initialCells={sheet.cells}
      canWrite={canWrite}
    />
  )
}
