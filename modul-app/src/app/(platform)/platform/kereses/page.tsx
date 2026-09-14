import type { Metadata } from 'next'
import Link from 'next/link'

import { PlatformSearchClient } from '@/components/platform/platform-search-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  getPlatformHrefMode,
  ph
} from '@/lib/platform/platform-href-server'
import { searchPlatform } from '@/lib/platform/search'
import { platformHref } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Keresés · Platform'
}

type SearchParams = Promise<{ q?: string }>

export default async function PlatformSearchPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const { q = '' } = await searchParams
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const hits = q.trim().length >= 2 ? await searchPlatform(ctx.admin, q) : []
  const mode = await getPlatformHrefMode()
  await ph('/')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-ink">Keresés</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Cég név/slug, user email, partner — egy mező.
        </p>
      </div>
      <PlatformSearchClient initialQuery={q} />
      {q.trim().length >= 2 ? (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {hits.length === 0 ? (
            <li className="px-4 py-6 text-body text-ink-secondary">
              Nincs találat.
            </li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <Link
                  href={platformHref(hit.href, mode)}
                  className="flex flex-col gap-0.5 px-4 py-3 no-underline hover:bg-subtle"
                >
                  <span className="text-body font-medium text-ink">
                    {hit.title}
                  </span>
                  <span className="text-hint text-ink-secondary">
                    {hit.kind === 'tenant'
                      ? 'Cég'
                      : hit.kind === 'member'
                        ? 'Felhasználó'
                        : 'Partner'}{' '}
                    · {hit.subtitle}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : (
        <p className="text-hint text-ink-secondary">
          Írj legalább 2 karaktert.
        </p>
      )}
    </div>
  )
}
