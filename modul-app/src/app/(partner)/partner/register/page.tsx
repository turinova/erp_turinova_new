import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerRegisterWizard } from '@/components/partner/partner-register-wizard'

export const metadata: Metadata = {
  title: 'Regisztráció'
}

export default function PartnerRegisterPage() {
  return (
    <PartnerAuthShell wide title="Regisztráció">
      <PartnerRegisterWizard />
    </PartnerAuthShell>
  )
}
