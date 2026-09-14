import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { PARTNER_LOGIN_PATH } from '@/lib/auth/surface'

export function PartnerAuthShell({
  title,
  description,
  children,
  wide = false
}: {
  title: string
  description: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <AuthMosaicShell
      title={title}
      description={description}
      homeHref={PARTNER_LOGIN_PATH}
      wide={wide}
    >
      {children}
    </AuthMosaicShell>
  )
}
