import type { Metadata } from 'next'

import { MediaLibraryClient } from '@/components/media/media-library-client'
import { getSessionUser } from '@/lib/auth/session'
import { listMediaFiles, type MediaKindFilter } from '@/lib/media/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Média'
}

function kindFromParam(v: string | string[] | undefined): MediaKindFilter {
  if (v === 'kep') return 'image'
  if (v === 'dokumentum') return 'pdf'
  return 'all'
}

export default async function MediaPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const kind = kindFromParam((await searchParams).tipus)
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  let rows: Awaited<ReturnType<typeof listMediaFiles>> = []
  let loadError: string | null = null

  if (user?.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (supabase) {
      try {
        rows = await listMediaFiles(supabase, user.tenantId, kind)
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni a médiát.'
      }
    } else {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    }
  } else if (user?.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et, és futtasd a media migrációt.'
  }

  if (loadError || !user?.tenantId) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Média</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError ?? 'Nincs aktív cég.'}
        </p>
        <p className="max-w-xl text-body text-ink-secondary">
          Futtasd a{' '}
          <code className="text-hint">
            supabase/migrations/20260422_tenant_media_library.sql
          </code>{' '}
          fájlt a Supabase SQL Editorben, majd frissítsd az oldalt.
        </p>
      </div>
    )
  }

  return (
    <MediaLibraryClient
      tenantId={user.tenantId}
      initialRows={rows}
      canWrite={canWrite}
      kind={kind}
    />
  )
}
