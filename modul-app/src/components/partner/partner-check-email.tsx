'use client'

import Link from 'next/link'
import { MailCheck } from 'lucide-react'

import { PartnerResendConfirmation } from '@/components/partner/partner-resend-confirmation'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'

export function PartnerCheckEmail({
  email,
  onRestart
}: {
  email: string
  onRestart: () => void
}) {
  const href = usePartnerHref()

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <MailCheck className="size-6 text-ink" aria-hidden />
        <h2 className="text-[15px] font-semibold text-ink">
          Nézd meg a postaládádat
        </h2>
        <p className="text-body text-ink-secondary">
          Küldtünk egy levelet ide:{' '}
          <span className="font-medium text-ink break-all">{email}</span>.
          Kattints a benne lévő Megerősítem gombra, és már be is léphetsz.
        </p>
        <p className="text-hint text-ink-secondary">
          Nem találod? Nézd meg a spam mappát is. A levél a
          noreply@turinova.hu címről érkezik.
        </p>
      </div>

      <PartnerResendConfirmation email={email} startWithCooldown />

      <div className="flex flex-col items-center gap-1.5 text-hint text-ink-secondary">
        <p>
          Rossz címet adtál meg?{' '}
          <button
            type="button"
            onClick={onRestart}
            className="font-medium text-ink underline-offset-2 hover:underline"
          >
            Kezdd újra
          </button>
        </p>
        <p>
          Már megerősítetted?{' '}
          <Link
            href={href(PARTNER_LOGIN_PATH)}
            className="font-medium text-ink no-underline hover:underline"
          >
            Belépés
          </Link>
        </p>
      </div>
    </div>
  )
}
