import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerForgotPasswordForm } from '@/components/partner/partner-forgot-password-form'

export const metadata: Metadata = {
  title: 'Elfelejtett jelszó'
}

type SearchParams = Promise<{ reason?: string }>

export default async function PartnerForgotPasswordPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const linkInvalid = params.reason === 'link_invalid'

  return (
    <PartnerAuthShell
      title="Elfelejtett jelszó"
      description="Add meg az emailedet, küldünk egy linket."
    >
      {linkInvalid ? (
        <p
          className="mb-3 border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
          role="alert"
        >
          A link lejárt vagy hibás. Kérj újat lent.
        </p>
      ) : null}
      <PartnerForgotPasswordForm />
    </PartnerAuthShell>
  )
}
