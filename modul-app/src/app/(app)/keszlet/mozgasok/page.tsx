import type { Metadata } from 'next'

import { StockMovementsListClient } from '@/components/stock/stock-movements-list-client'
import { getSessionUser } from '@/lib/auth/session'
import {
  listStockMovements,
  type StockMovementListResult
} from '@/lib/stock/movements-queries'
import type {
  StockMovementSource,
  StockMovementType
} from '@/lib/supabase/database.types'
import { listActiveWarehouses } from '@/lib/warehouses/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Készletmozgások'
}

const MOVEMENT_TYPES = new Set<StockMovementType>(['in', 'out'])
const SOURCE_TYPES = new Set<StockMovementSource>([
  'purchase_receipt',
  'adjustment',
  'sale',
  'transfer'
])

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function MozgasokPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const warehouseId =
    typeof sp.warehouseId === 'string' ? sp.warehouseId : 'all'
  const movementTypeRaw =
    typeof sp.movementType === 'string' ? sp.movementType : 'all'
  const sourceTypeRaw =
    typeof sp.sourceType === 'string' ? sp.sourceType : 'all'
  const pageRaw = typeof sp.page === 'string' ? Number(sp.page) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const movementType: StockMovementType | 'all' =
    movementTypeRaw !== 'all' &&
    MOVEMENT_TYPES.has(movementTypeRaw as StockMovementType)
      ? (movementTypeRaw as StockMovementType)
      : 'all'
  const sourceType: StockMovementSource | 'all' =
    sourceTypeRaw !== 'all' &&
    SOURCE_TYPES.has(sourceTypeRaw as StockMovementSource)
      ? (sourceTypeRaw as StockMovementSource)
      : 'all'

  const user = await getSessionUser()

  let result: StockMovementListResult = {
    rows: [],
    total: 0,
    page: 1,
    limit: 25
  }
  let warehouses: Awaited<ReturnType<typeof listActiveWarehouses>> = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        const [list, wh] = await Promise.all([
          listStockMovements(supabase, {
            tenantId: user.tenantId,
            q,
            warehouseId,
            movementType,
            sourceType,
            page,
            limit: 25
          }),
          listActiveWarehouses(supabase, user.tenantId)
        ])
        result = list
        warehouses = wh
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a mozgásokat.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError = 'Dev bypass módban nincs tenant adatbázis.'
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Készletmozgások</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <StockMovementsListClient
      initialRows={result.rows}
      total={result.total}
      page={result.page}
      limit={result.limit}
      q={q}
      warehouseId={warehouseId}
      movementType={movementType}
      sourceType={sourceType}
      warehouses={warehouses}
    />
  )
}
