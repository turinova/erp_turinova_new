import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { KiemeltPartnerekClient } from '@/components/kiemelt-partnerek/kiemelt-partnerek-client'
import { getSessionUser } from '@/lib/auth/session'
import { budapestYear } from '@/lib/home/date'
import {
  getKiemeltPartnerekPageData,
  type KiemeltActivity,
  type KiemeltSort
} from '@/lib/kiemelt-partnerek/queries'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Kiemelt partnerek'
}

type SearchParams = Promise<{
  q?: string
  year?: string
  sort?: string
  activity?: string
}>

function parseSort(raw: string | undefined): KiemeltSort {
  if (
    raw === 'last_order' ||
    raw === 'cutting_90d' ||
    raw === 'name' ||
    raw === 'avg_monthly'
  ) {
    return raw
  }
  return 'avg_monthly'
}

function parseActivity(raw: string | undefined): KiemeltActivity {
  if (raw === 'active' || raw === 'silent' || raw === 'down') return raw
  return 'all'
}

export default async function KiemeltPartnerekPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const user = await getSessionUser()
  const yearNow = budapestYear()
  const year = Math.max(
    2020,
    Math.min(yearNow + 1, Number(params.year) || yearNow)
  )
  const q = params.q?.trim() ?? ''
  const sort = parseSort(params.sort)
  const activity = parseActivity(params.activity)

  let loadError: string | null = null
  let data: Awaited<ReturnType<typeof getKiemeltPartnerekPageData>> | null =
    null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      const has = await tenantHasLapszabaszat(supabase, user.tenantId)
      if (!has) {
        redirect('/home')
      }
      try {
        data = await getKiemeltPartnerekPageData(supabase, user.tenantId, {
          year
        })
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a kiemelt partnereket.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  }

  if (loadError || !data) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-6 text-body text-ink-secondary">
        {loadError ?? 'Nincs adat.'}
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <KiemeltPartnerekClient
        data={data}
        initialQ={q}
        initialSort={sort}
        initialActivity={activity}
      />
    </Suspense>
  )
}
