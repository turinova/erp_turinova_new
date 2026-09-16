import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerResetPasswordForm } from '@/components/partner/partner-reset-password-form'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új jelszó'
}

export default async function PartnerResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  return (
    <PartnerAuthShell
      title="Új jelszó"
      description={
        user ? 'Írd be az új jelszavad kétszer.' : undefined
      }
    >
      {user ? (
        <PartnerResetPasswordForm />
      ) : (
        <p
          className="border border-border bg-subtle px-2.5 py-1.5 text-hint text-ink-secondary"
          role="status"
        >
          Ehhez az oldalhoz az emailben kapott link kell. Ha lejárt, kérj újat az
          „Elfelejtetted a jelszavad?” oldalon.
        </p>
      )}
    </PartnerAuthShell>
  )
}
