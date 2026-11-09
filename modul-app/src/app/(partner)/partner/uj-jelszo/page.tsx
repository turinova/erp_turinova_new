import type { Metadata } from 'next'
import Link from 'next/link'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerResetPasswordForm } from '@/components/partner/partner-reset-password-form'
import { partnerServerHref } from '@/lib/auth/partner-href-server'
import {
  PARTNER_FORGOT_PASSWORD_PATH,
  PARTNER_LOGIN_PATH
} from '@/lib/auth/surface'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új jelszó'
}

export default async function PartnerResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  const forgotHref = await partnerServerHref(PARTNER_FORGOT_PASSWORD_PATH)
  const loginHref = await partnerServerHref(PARTNER_LOGIN_PATH)

  return (
    <PartnerAuthShell
      title="Új jelszó"
      description={
        user
          ? 'Írd be az új jelszavad kétszer. Utána belépsz a partner felületre.'
          : undefined
      }
    >
      {user ? (
        <PartnerResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-3.5">
          <p
            className="border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink"
            role="alert"
          >
            Ehhez az oldalhoz az emailben kapott érvényes link kell. A link
            lejárhat, vagy már felhasználták (pl. előnézet / másik kattintás).
          </p>
          <p className="text-center text-hint text-ink-secondary">
            <Link
              href={forgotHref}
              className="font-medium text-ink no-underline hover:underline"
            >
              Új jelszó-link kérése
            </Link>
            {' · '}
            <Link
              href={loginHref}
              className="font-medium text-ink no-underline hover:underline"
            >
              Belépés
            </Link>
          </p>
        </div>
      )}
    </PartnerAuthShell>
  )
}
