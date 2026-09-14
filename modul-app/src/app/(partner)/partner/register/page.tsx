import type { Metadata } from 'next'

import { PartnerAuthShell } from '@/components/partner/partner-auth-shell'
import { PartnerRegisterWizard } from '@/components/partner/partner-register-wizard'

export const metadata: Metadata = {
  title: 'Regisztráció · Asztalos'
}

export default function PartnerRegisterPage() {
  return (
    <PartnerAuthShell
      wide
      title="Regisztráció"
      description="Asztalos fiók — számlázás és default lapszabászat a következő lépésekben."
    >
      <PartnerRegisterWizard />
    </PartnerAuthShell>
  )
}
