import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LegalDocView } from '@/components/storefront/legal-doc-view'
import { StorefrontFrame } from '@/components/storefront/storefront-chrome'
import { formatLegalDate } from '@/lib/storefront/legal'
import { getStorefrontShell } from '@/lib/storefront/shell'
import { legalPath, LEGAL_DOCS } from '@/lib/webshop/legal/constants'
import { isLegalDocKind } from '@/lib/webshop/legal/types'
import { getLegalVersion } from '@/lib/webshop/legal/versions'

export const revalidate = 3600

type PageProps = { params: Promise<{ site: string; doc: string; version: string }> }

function versionNumber(v: string): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { site, doc } = await params
  if (!isLegalDocKind(doc)) return {}
  const shell = await getStorefrontShell(site)
  return {
    title: { absolute: `${LEGAL_DOCS[doc].title} (archív) · ${shell?.seller.name ?? 'Bolt'}` },
    robots: { index: false, follow: true }
  }
}

export default async function StorefrontLegalArchivePage({ params }: PageProps) {
  const { site, doc: kind, version } = await params
  const n = versionNumber(version)
  if (!isLegalDocKind(kind) || n == null) notFound()
  const shell = await getStorefrontShell(site)
  if (!shell) notFound()
  const row = await getLegalVersion(shell.admin, shell.tenant.id, kind, n)
  if (!row) notFound()

  return (
    <StorefrontFrame seller={shell.seller} settings={shell.settings} categories={shell.categories}>
      <main>
        <LegalDocView
          doc={row.doc}
          archiveNotice={
            <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[14px] text-ink" role="note">
              Ez egy korábbi, már nem hatályos változat ({row.version}., {formatLegalDate(row.createdAt)}).{' '}
              <a href={legalPath(kind)} className="cursor-pointer font-medium underline underline-offset-2">
                A hatályos változat
              </a>
            </p>
          }
          meta={<p>{row.version}. változat · közzétéve: {formatLegalDate(row.createdAt)}</p>}
        />
      </main>
    </StorefrontFrame>
  )
}
