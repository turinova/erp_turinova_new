import type { Metadata } from 'next'

import { KioskWizardClient } from '@/components/kiosk/kiosk-wizard-client'
import { loadKioskBootstrap } from '@/lib/kiosk/bootstrap'
import { createServiceClient } from '@/lib/supabase/service'

export const metadata: Metadata = {
  title: 'Bolti lapszab',
  robots: { index: false, follow: false }
}

type Params = Promise<{ slug: string }>

export default async function KioskPage({ params }: { params: Params }) {
  const { slug } = await params
  const safeSlug = slug || 'demo'

  const admin = createServiceClient()
  if (!admin) {
    return (
      <KioskGateMessage
        title="Kiosk nem elérhető"
        body="A szerver nincs beállítva (Supabase). Kapcsold be az env-et."
      />
    )
  }

  const result = await loadKioskBootstrap(admin, safeSlug)
  if (!result.ok) {
    return (
      <KioskGateMessage
        title={
          result.code === 'not_found'
            ? 'Kiosk nem található'
            : result.code === 'disabled'
              ? 'Kiosk kikapcsolva'
              : 'Kiosk nem elérhető'
        }
        body={result.message}
      />
    )
  }

  return <KioskWizardClient slug={safeSlug} bootstrap={result.data} />
}

function KioskGateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAFAFA] p-6">
      <div className="max-w-md space-y-3 rounded-xl border border-border bg-white p-6 text-center shadow-sm">
        <h1 className="text-[22px] font-semibold text-ink">{title}</h1>
        <p className="text-[15px] text-ink-secondary">{body}</p>
        <p className="text-[13px] text-ink-muted">Szólj a pultnál.</p>
      </div>
    </div>
  )
}
