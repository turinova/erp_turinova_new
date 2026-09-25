'use client'

import {
  AlertTriangle,
  Check,
  CircleHelp,
  Clock,
  Copy,
  ExternalLink,
  PartyPopper
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { StatusBadge, type StatusBadgeTone } from '@/components/patterns/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SUPPORT_EMAIL } from '@/lib/marketing/pricing'
import { normalizeDomainInput } from '@/lib/storefront/domains/normalize'
import { DNS_PROVIDERS, providerById } from '@/lib/storefront/domains/providers'
import type {
  DomainRecordCheck,
  DomainStatus,
  DomainView,
  RecordState
} from '@/lib/storefront/domains/types'
import {
  checkCustomDomain,
  removeCustomDomain,
  setDomainProvider,
  startCustomDomain
} from '@/lib/webshop/domain-actions'
import { cn } from '@/lib/utils'

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, { label: string; tone: StatusBadgeTone }> = {
  active: { label: 'Kész', tone: 'success' },
  pending: { label: 'Teendőd van', tone: 'warning' },
  verifying: { label: 'Ellenőrzés alatt (kb. 10 perc)', tone: 'info' },
  error: { label: 'Hiba', tone: 'danger' }
}

const POLL_MS = 20_000

type Step = 1 | 2 | 3

type Props = {
  open: boolean
  initial: DomainView | null
  onOpenChange: (open: boolean) => void
}

export function DomainWizard({ open, initial, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [domain, setDomain] = useState<DomainView | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setDomain(initial)
    setInput('')
    setError(null)
    setStep(initial ? 3 : 1)
  }, [open, initial])

  const preview = useMemo(() => {
    if (!input.trim()) return null
    const n = normalizeDomainInput(input)
    return n.ok ? n : null
  }, [input])

  function submitDomain(e: React.FormEvent) {
    e.preventDefault()
    const n = normalizeDomainInput(input)
    if (!n.ok) {
      setError(n.message)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await startCustomDomain({ domain: input })
      if (!res.ok) {
        setError(res.message)
        return
      }
      setDomain(res.domain)
      setStep(res.domain?.status === 'active' ? 3 : 2)
    })
  }

  function changeDomain() {
    if (!domain) {
      setStep(1)
      return
    }
    startTransition(async () => {
      const res = await removeCustomDomain(domain.id)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setDomain(null)
      setInput('')
      setStep(1)
    })
  }

  const stepTitle: Record<Step, string> = {
    1: 'Mi a domained?',
    2: 'Hol van a domained?',
    3: domain?.status === 'active' ? 'Kész!' : 'Vedd fel ezeket a rekordokat'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <p className="text-hint text-ink-secondary">{step} / 3. lépés</p>
          <DialogTitle>{stepTitle[step]}</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Azt a címet írd be, amit megvettél (például egy domainregisztrálónál vagy a tárhelyeddel együtt).'
              : step === 2
                ? 'Ott kell majd két sort beírnod. Megmutatjuk, hol találod.'
                : domain?.status === 'active'
                  ? 'A boltod a saját domaineden fut.'
                  : 'Másold át a lenti adatokat a szolgáltatód DNS-beállításaiba. Mi közben figyeljük, és szólunk, ha minden rendben.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <form id="domain-step-1" onSubmit={submitDomain} className="space-y-2">
            <FormField
              label="A domained"
              htmlFor="domain-input"
              hint="Például: cegem.hu — a www-s változatot is beállítjuk."
              error={error ?? undefined}
            >
              <Input
                id="domain-input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setError(null)
                }}
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="url"
                className="h-10 text-[15px]"
              />
            </FormField>
            {preview && preview.hostname !== input.trim().toLowerCase() ? (
              <p className="text-hint text-ink-secondary" aria-live="polite">
                Ezt kötjük be: <span className="font-medium text-ink">{preview.hostname}</span>
              </p>
            ) : null}
          </form>
        ) : null}

        {step === 2 && domain ? (
          <ProviderStep domain={domain} onChange={setDomain} />
        ) : null}

        {step === 3 && domain ? (
          <RecordsStep domain={domain} onChange={setDomain} active={open} />
        ) : null}

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex gap-1.5">
            {step === 2 ? (
              <Button type="button" variant="ghost" loading={pending} onClick={changeDomain}>
                Másik domaint írok be
              </Button>
            ) : null}
            {step === 3 && domain?.status !== 'active' ? (
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Vissza
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-1.5 sm:flex-row">
            {step === 1 ? (
              <>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Mégse
                </Button>
                <Button type="submit" form="domain-step-1" loading={pending}>
                  Tovább
                </Button>
              </>
            ) : null}
            {step === 2 ? (
              <Button type="button" onClick={() => setStep(3)}>
                Tovább a rekordokhoz
              </Button>
            ) : null}
            {step === 3 ? (
              domain?.status === 'active' ? (
                <Button type="button" onClick={() => onOpenChange(false)}>
                  Kész
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Bezárom, később folytatom
                </Button>
              )
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProviderStep({
  domain,
  onChange
}: {
  domain: DomainView
  onChange: (d: DomainView) => void
}) {
  const [saving, startTransition] = useTransition()
  const detected = domain.result?.detectedProvider ?? null
  const provider = providerById(domain.provider)

  if (domain.status === 'error') {
    return (
      <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-body text-danger-ink">
        {domain.lastError ?? 'Ezt a domaint nem találjuk.'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {detected && detected !== 'other' ? (
        <p className="text-body text-ink">
          Úgy látjuk, a domained DNS-e itt van:{' '}
          <span className="font-semibold">{providerById(detected).name}</span>.
        </p>
      ) : null}

      <FormField
        label="Szolgáltató"
        htmlFor="domain-provider"
        hint="Ha nem ez, válaszd ki, hol vetted a domaint."
      >
        <Select
          id="domain-provider"
          value={provider.id}
          disabled={saving}
          onChange={(e) => {
            const value = e.target.value
            startTransition(async () => {
              const res = await setDomainProvider(domain.id, value)
              if (res.ok && res.domain) onChange(res.domain)
              else if (!res.ok) toast.error(res.message)
            })
          }}
          className="h-10"
        >
          {DNS_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="rounded-md border border-border bg-subtle p-3">
        <p className="text-label text-ink">Így találod meg</p>
        <p className="mt-1 text-body text-ink">{provider.where}</p>
        {provider.extra ? <p className="mt-2 text-body font-medium text-ink">{provider.extra}</p> : null}
        {provider.loginUrl ? (
          <a
            href={provider.loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {provider.name} megnyitása
            <span className="sr-only">(új lapon)</span>
          </a>
        ) : null}
      </div>
    </div>
  )
}

const RECORD_STATE: Record<RecordState, { label: string; icon: typeof Check; className: string }> = {
  ok: { label: 'Rendben', icon: Check, className: 'text-success-ink' },
  missing: { label: 'Még nem látjuk', icon: Clock, className: 'text-ink-secondary' },
  wrong: { label: 'Javítani kell', icon: AlertTriangle, className: 'text-warning-ink' },
  unknown: { label: 'Nem tudtuk ellenőrizni', icon: CircleHelp, className: 'text-ink-secondary' }
}

function RecordsStep({
  domain,
  onChange,
  active
}: {
  domain: DomainView
  onChange: (d: DomainView) => void
  active: boolean
}) {
  const [checking, startTransition] = useTransition()
  const [help, setHelp] = useState(false)
  const provider = providerById(domain.provider)
  const result = domain.result
  const records = result?.records ?? []

  const recheck = useCallback(
    (manual: boolean) => {
      startTransition(async () => {
        const res = await checkCustomDomain(domain.id)
        if (!res.ok) {
          if (manual) toast.error(res.message)
          return
        }
        if (res.domain) {
          if (res.domain.status === 'active' && domain.status !== 'active') {
            toast.success(`Kész! A boltod már a(z) ${res.domain.hostname} címen fut.`)
          }
          onChange(res.domain)
        }
      })
    },
    [domain.id, domain.status, onChange]
  )

  useEffect(() => {
    if (!active || domain.status === 'active') return
    const id = window.setInterval(() => recheck(false), POLL_MS)
    return () => window.clearInterval(id)
  }, [active, domain.status, recheck])

  if (domain.status === 'active') {
    const url = `https://${domain.hostname}`
    return (
      <div className="rounded-md border border-success/40 bg-success-soft p-4">
        <p className="flex items-center gap-2 text-body font-semibold text-success-ink">
          <PartyPopper className="size-4" aria-hidden />
          A boltod mostantól itt érhető el: {domain.hostname}
        </p>
        <p className="mt-1 text-body text-ink">
          A régi címről automatikusan ide irányítunk, és a Google, a Bing és a termékfeedek is ezt a címet kapják.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Megnyitom
          <span className="sr-only">(új lapon)</span>
        </a>
      </div>
    )
  }

  const okCount = records.filter((r) => r.state === 'ok').length

  return (
    <div className="space-y-4">
      {provider.apexHint && records.some((r) => r.name === '@') ? (
        <p className="text-body text-ink-secondary">{provider.apexHint}</p>
      ) : null}
      {provider.extra ? <p className="text-body font-medium text-ink">{provider.extra}</p> : null}

      {records.length === 0 && result?.detectedProvider === 'vercel' ? (
        <p className="text-body text-ink">Nincs mit beírnod — a domained már jó helyre mutat.</p>
      ) : (
        <ol className="space-y-3">
          {records.map((r, i) => (
            <RecordCard key={r.key} index={i + 1} record={r} />
          ))}
        </ol>
      )}

      {result && result.issues.length > 0 ? (
        <div role="alert" className="space-y-2 rounded-md border border-warning/45 bg-warning-soft p-3">
          {result.issues.map((issue) => (
            <div key={issue.code}>
              <p className="flex items-center gap-1.5 text-body font-semibold text-warning-ink">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                {issue.title}
              </p>
              <p className="mt-0.5 text-body text-ink">{issue.fix}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-subtle px-3 py-2.5">
        <div className="min-w-0 flex-1" aria-live="polite">
          <StatusBadge tone={DOMAIN_STATUS_LABEL[domain.status].tone}>
            {DOMAIN_STATUS_LABEL[domain.status].label}
          </StatusBadge>
          <p className="mt-1 text-hint text-ink-secondary">
            {domain.status === 'verifying'
              ? domain.lastError ??
                'A rekordok rendben vannak. Most készül a biztonsági tanúsítvány (https) — ez kb. 10 perc.'
              : `${okCount} / ${records.length} rekord rendben. 20 másodpercenként újra megnézzük.`}
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" loading={checking} onClick={() => recheck(true)}>
          Ellenőrzöm most
        </Button>
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={help}
          onClick={() => setHelp((v) => !v)}
        >
          <CircleHelp className="size-3.5" aria-hidden />
          Elakadtam
        </Button>
        {help ? (
          <div className="mt-2 space-y-2 rounded-md border border-border p-3 text-body text-ink">
            <p className="font-medium">A leggyakoribb hibák:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A Név mezőbe a teljes domaint írtad (pl. „www.cegem.hu”). Csak ennyi kell: www — vagy @ a fő domainnél.</li>
              <li>Maradt egy régi A rekord a @ névnél. Töröld, csak a mi értékünk maradjon.</li>
              <li>Cloudflare-nél narancs a felhő. Kattints rá, hogy szürke legyen („DNS only”).</li>
              <li>Most mentetted el: a változás 5–10 perc, ritkán pár óra, mire mindenhol látszik.</li>
            </ul>
            <p>
              Nem megy?{' '}
              <a
                className="font-medium underline underline-offset-2"
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Domain bekötés: ${domain.hostname}`)}&body=${encodeURIComponent(
                  `Domain: ${domain.hostname}\nSzolgáltató: ${provider.name}\n\n` +
                    records.map((r) => `${r.type} ${r.name} → ${r.value}: ${RECORD_STATE[r.state].label}`).join('\n')
                )}`}
              >
                Írj nekünk
              </a>
              , és átnézzük helyetted. Az ellenőrzés eredményét automatikusan beletesszük a levélbe.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  function copy() {
    void navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} kimásolva`),
      () => toast.error('Nem sikerült másolni — jelöld ki és másold kézzel.')
    )
  }
  return (
    <div className="min-w-0">
      <p className="text-hint text-ink-secondary">{label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate rounded bg-subtle px-2 py-1 font-mono text-[13px] text-ink" title={value}>
          {value}
        </code>
        <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`${label} másolása`}>
          <Copy className="size-3.5" aria-hidden />
          Másolás
        </Button>
      </div>
    </div>
  )
}

function RecordCard({ index, record }: { index: number; record: DomainRecordCheck }) {
  const state = RECORD_STATE[record.state]
  const Icon = state.icon
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-ink">{index}. rekord</p>
        <p className={cn('flex items-center gap-1 text-hint font-medium', state.className)}>
          <Icon className="size-3.5" aria-hidden />
          {state.label}
        </p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[88px_1fr]">
        <div>
          <p className="text-hint text-ink-secondary">Típus</p>
          <p className="mt-0.5 py-1 font-mono text-[13px] font-semibold text-ink">{record.type}</p>
        </div>
        <CopyField label="Név" value={record.name} />
      </div>
      <div className="mt-2">
        <CopyField label="Érték" value={record.value} />
      </div>
      {record.problem ? (
        <p className={cn('mt-2 text-body', record.state === 'wrong' ? 'text-warning-ink' : 'text-ink-secondary')}>
          {record.problem}
        </p>
      ) : null}
    </li>
  )
}
