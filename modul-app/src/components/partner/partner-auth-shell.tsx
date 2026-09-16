import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { PartnerLegalLinks } from '@/components/partner/partner-legal-links'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'

export function PartnerAuthShell({
  title,
  description,
  children,
  wide = false
}: {
  title: string
  description?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <AuthMosaicShell
      variant="partner"
      title={title}
      description={description}
      homeHref={PARTNER_LOGIN_PATH}
      wide={wide}
      badge="Optinova"
      footer={<PartnerLegalLinks className="mt-4" />}
    >
      {children}
    </AuthMosaicShell>
  )
}
