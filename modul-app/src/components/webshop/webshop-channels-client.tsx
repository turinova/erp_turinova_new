'use client'

import { ExternalLink, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { DOMAIN_STATUS_LABEL, DomainWizard } from '@/components/webshop/domain-wizard'
import type { DomainView } from '@/lib/storefront/domains/types'
import { removeCustomDomain, setPrimaryDomain } from '@/lib/webshop/domain-actions'

type Props = {
  canWrite: boolean
  primaryUrl: string
  primaryIsCustom: boolean
  subdomainUrl: string | null
  indexNowLive: boolean
  domains: DomainView[]
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export function WebshopChannelsClient({
  canWrite,
  primaryUrl,
  primaryIsCustom,
  subdomainUrl,
  indexNowLive,
  domains
}: Props) {
  const router = useRouter()
  const [wizard, setWizard] = useState<{ open: boolean; domain: DomainView | null }>({
    open: false,
    domain: null
  })
  const [removing, setRemoving] = useState<DomainView | null>(null)
  const [pending, startTransition] = useTransition()

  const custom = domains[0] ?? null

  function onRemove() {
    if (!removing) return
    const target = removing
    startTransition(async () => {
      const res = await removeCustomDomain(target.id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(`${target.hostname} levéve. A bolt az aldomainen érhető el.`)
      setRemoving(null)
      router.refresh()
    })
  }

  function onMakePrimary(d: DomainView) {
    startTransition(async () => {
      const res = await setPrimaryDomain(d.id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(`Mostantól ${d.hostname} a bolt fő címe.`)
      router.refresh()
    })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Csatornák"
        description="Hol éri el a vevő a boltodat, és kik kapnak róla automatikusan jelzést."
        actions={
          canWrite && !custom ? (
            <Button type="button" onClick={() => setWizard({ open: true, domain: null })}>
              <Plus className="size-3.5" aria-hidden />
              Saját domaint kötök
            </Button>
          ) : null
        }
      />

      <section aria-labelledby="bolt-cime" className="mt-4 rounded-lg border border-border bg-surface">
        <h2 id="bolt-cime" className="border-b border-border px-4 py-2.5 text-label text-ink">
          A boltod címe
        </h2>
        <ul className="divide-y divide-border">
          <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-hint text-ink-secondary">Fő cím</p>
              <p className="truncate text-body font-medium text-ink">{displayUrl(primaryUrl)}</p>
            </div>
            <StatusBadge tone="success">Kész</StatusBadge>
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Megnyitom
              <span className="sr-only">(új lapon)</span>
            </a>
          </li>

          {primaryIsCustom && subdomainUrl ? (
            <li className="px-4 py-3">
              <p className="text-hint text-ink-secondary">Tartalék cím</p>
              <p className="text-body text-ink">
                {displayUrl(subdomainUrl)}{' '}
                <span className="text-ink-secondary">— ez is működik, a fő címre visz.</span>
              </p>
            </li>
          ) : null}

          {custom && !(custom.status === 'active' && custom.isPrimary) ? (
            <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-hint text-ink-secondary">Saját domain</p>
                <p className="truncate text-body font-medium text-ink">{custom.hostname}</p>
                {custom.status !== 'active' ? (
                  <p className="text-hint text-ink-secondary">
                    Amíg nem kész, a vevők a fenti címen érik el a boltot.
                  </p>
                ) : null}
              </div>
              <StatusBadge tone={DOMAIN_STATUS_LABEL[custom.status].tone}>
                {DOMAIN_STATUS_LABEL[custom.status].label}
              </StatusBadge>
              {canWrite && custom.status !== 'active' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setWizard({ open: true, domain: custom })}
                >
                  Folytatom
                </Button>
              ) : null}
              {canWrite && custom.status === 'active' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={pending}
                  onClick={() => onMakePrimary(custom)}
                >
                  Legyen ez a fő cím
                </Button>
              ) : null}
              {canWrite ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(custom)}>
                  Leveszem
                </Button>
              ) : null}
            </li>
          ) : null}

          {custom && custom.status === 'active' && custom.isPrimary && canWrite ? (
            <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <p className="text-hint text-ink-secondary">
                A saját domained ({custom.hostname}) működik és ez a fő cím.
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(custom)}>
                Domain levétele
              </Button>
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="bing" className="mt-4 rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 id="bing" className="text-label text-ink">
            Bing és Copilot
          </h2>
          <StatusBadge tone={indexNowLive ? 'success' : 'neutral'}>
            {indexNowLive ? 'Automatikus' : 'Élesítés után indul'}
          </StatusBadge>
        </div>
        <p className="px-4 py-3 text-body text-ink-secondary">
          {indexNowLive
            ? 'Nincs teendőd. Minden termékmentés után azonnal szólunk a Bingnek (IndexNow), így az új és módosított termékek gyorsan megjelennek a Bing és a Copilot találatai között.'
            : 'Nincs teendőd. Amint a bolt nyilvános címen fut, minden termékmentés után automatikusan szólunk a Bingnek (IndexNow).'}
        </p>
      </section>

      <DomainWizard
        open={wizard.open}
        initial={wizard.domain}
        onOpenChange={(open) => {
          setWizard((w) => ({ ...w, open }))
          if (!open) router.refresh()
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={`Leveszed a(z) ${removing?.hostname ?? ''} domaint?`}
        description="A bolt ezután az aldomainen lesz elérhető. A DNS-rekordokat a szolgáltatódnál neked kell törölnöd, ha már nem kellenek."
        confirmLabel="Domain levétele"
        loading={pending}
        onConfirm={onRemove}
      />
    </div>
  )
}
