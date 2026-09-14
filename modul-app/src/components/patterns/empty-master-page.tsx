'use client'

import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'

type EmptyMasterPageProps = {
  title: string
  /** pl. "Törzsadatok → Rendszer" */
  sectionPath: string
  entityLabel: string
}

export function EmptyMasterPage({
  title,
  sectionPath,
  entityLabel
}: EmptyMasterPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={`${sectionPath}. A lista és szerkesztés hamarosan.`}
      />
      <section className="max-w-xl border border-dashed border-border bg-subtle p-4">
        <p className="text-body text-ink-secondary">
          Ez az oldal még üres. Itt fogod kezelni a(z) {entityLabel} törzsadatokat.
        </p>
      </section>
    </div>
  )
}
