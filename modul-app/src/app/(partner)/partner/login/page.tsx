import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerLoginForm } from '@/components/partner/partner-login-form'

export const metadata: Metadata = {
  title: 'Belépés'
}

type SearchParams = Promise<{ reason?: string }>

export default async function PartnerLoginPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const accountDeleted = params.reason === 'account_deleted'
  const disabled = params.reason === 'disabled'
  const confirmLink = params.reason === 'confirm_link'

  return (
    <PartnerAuthShell title="Belépés">
      {accountDeleted ? (
        <p
          className="mb-3 border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          A fiókodat töröltük.
        </p>
      ) : null}
      {confirmLink ? (
        <p
          className="mb-3 border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          Ez a megerősítő link már nem érvényes. Ha korábban rákattintottál, egyszerűen lépj be.
          Ha a belépés nem megy, ott kérhetsz új levelet.
        </p>
      ) : null}
      {disabled ? (
        <p
          className="mb-3 border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
          role="alert"
        >
          A fiókod ki van kapcsolva. Ha szerinted ez hiba, írj nekünk.
        </p>
      ) : null}
      <PartnerLoginForm />
    </PartnerAuthShell>
  )
}
