import { AuthMosaicShell } from '@/components/auth/auth-mosaic-shell'
import { PARTNER_HOST_LABEL, PARTNER_LOGIN_PATH } from '@/lib/auth/surface'

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
      variant="partner"
      title={title}
      description={description}
      homeHref={PARTNER_LOGIN_PATH}
      wide={wide}
      badge="ASZTALOS PORTÁL"
      footer={
        <p className="mt-4 text-center text-hint text-ink-muted">
          {PARTNER_HOST_LABEL} · nem a céges ERP
        </p>
      }
    >
      {children}
    </AuthMosaicShell>
  )
}
