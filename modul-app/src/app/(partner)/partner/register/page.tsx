import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerRegisterWizard } from '@/components/partner/partner-register-wizard'
import { PARTNER_HOST_LABEL } from '@/lib/auth/surface'

export const metadata: Metadata = {
  title: 'Asztalos regisztráció'
}

export default function PartnerRegisterPage() {
  return (
    <PartnerAuthShell
      wide
      title="Asztalos regisztráció"
      description={`Fiók a ${PARTNER_HOST_LABEL} partner portálra — nem céges staff hozzáférés.`}
    >
      <PartnerRegisterWizard />
    </PartnerAuthShell>
  )
}
