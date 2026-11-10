'use client'

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Handshake,
  Lock,
  MessageSquare,
  Printer,
  Smartphone
} from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { saveReviewSettingsAction } from '@/lib/reviews/actions'
import type {
  PartnerReviewStats,
  ReviewClickStats,
  ReviewThankSmsStats
} from '@/lib/reviews/queries'
import {
  HANDOVER_QR_TEXT_MAX,
  REVIEW_FREQUENCY_OPTIONS,
  THANK_SMS_TIMING_OPTIONS,
  type ReviewFrequencyDays,
  type ReviewSettings
} from '@/lib/reviews/settings'
import { cn } from '@/lib/utils'

type Props = {
  initial: ReviewSettings
  available: boolean
  canWrite: boolean
  google: { available: boolean; reviewUrl: string | null; shortUrl: string | null }
  clicks: ReviewClickStats
  thankSms: ReviewThankSmsStats
  hasSms: boolean
  hasPartnerPortal: boolean
  partnerStats: PartnerReviewStats
}

const nf = new Intl.NumberFormat('hu-HU')

function SettingsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-hint font-medium text-ink hover:underline"
    >
      {children}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  )
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Printer }) {
  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-hint text-ink-secondary">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-ink">{nf.format(value)}</p>
    </div>
  )
}

export function ReviewSettingsForm({
  initial,
  available,
  canWrite,
  google,
  clicks,
  thankSms,
  hasSms,
  hasPartnerPortal,
  partnerStats
}: Props) {
  const [settings, setSettings] = useState<ReviewSettings>(initial)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const hasLink = Boolean(google.reviewUrl && google.shortUrl)
  const disabled = !canWrite || pending || !available
  const channelDisabled = disabled || !hasLink

  function patch(p: Partial<ReviewSettings>) {
    setSettings((s) => ({ ...s, ...p }))
  }

  function save() {
    setFieldErrors({})
    startTransition(async () => {
      const result = await saveReviewSettingsAction(settings)
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        toast.error(result.message)
        return
      }
      toast.success('Google értékelés beállítások mentve.')
    })
  }

  const activeCount = [
    settings.statusPageEnabled,
    settings.handoverQrEnabled,
    settings.thankSmsEnabled && hasSms,
    settings.partnerPortalEnabled && hasPartnerPortal && partnerStats.available
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Google értékelések"
        description="Hol és mikor kérjük meg a vevőt, hogy értékeljen a Google-ön. Mindenki ugyanazt a linket kapja, nem szűrünk elégedettség szerint."
        actions={
          canWrite && available ? (
            <Button type="button" onClick={save} loading={pending}>
              {pending ? 'Mentés…' : 'Mentés'}
            </Button>
          ) : null
        }
      />

      {!available ? (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
          A beállításokhoz futtasd a{' '}
          <code className="text-hint">20261004_review_requests.sql</code> migrációt.
        </p>
      ) : null}
      {!canWrite ? (
        <p className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
          Csak megtekintési jogod van, nem módosíthatsz.
        </p>
      ) : null}

      <FormSection title="Értékelő link" columns={1}>
        {hasLink ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-body text-ink">
              <CheckCircle2 className="size-4 shrink-0 text-success-ink" aria-hidden />
              <span className="truncate">
                Beállítva · <span className="font-mono text-ink-secondary">{google.shortUrl}</span>
              </span>
            </p>
            <SettingsLink href="/beallitasok/cegadatok">Módosítás a Cégadatokban</SettingsLink>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5">
            <p className="flex items-start gap-1.5 text-body text-warning-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {google.available
                ? 'Előbb add meg a Google értékelő linket, addig egyik csatorna sem működik.'
                : 'Futtasd a 20261003 migrációt, majd add meg az értékelő linket a Cégadatokban.'}
            </p>
            <Link
              href="/beallitasok/cegadatok"
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              Értékelő link megadása
            </Link>
          </div>
        )}
      </FormSection>

      <FormSection
        title="Megnyitások az utolsó 30 napban"
        description={`${activeCount} csatorna bekapcsolva. A link-előnézetek (Messenger, Viber stb.) nem számítanak.`}
        columns={4}
      >
        <StatTile label="Státusz oldal" value={clicks.status} icon={Smartphone} />
        <StatTile label="QR-kód" value={clicks.qr} icon={Printer} />
        <StatTile label="Köszönő SMS" value={clicks.sms} icon={MessageSquare} />
        {hasPartnerPortal ? (
          <StatTile label="Partnerportál" value={clicks.partner} icon={Handshake} />
        ) : null}
        <StatTile label="Egyéb" value={clicks.other} icon={ArrowRight} />
      </FormSection>

      <FormSection
        title="1. Vevői státusz oldal"
        description="Az SMS-ben kapott linkről nyíló oldal. Ingyenes, hozzájárulás nem kell hozzá."
        columns={1}
      >
        <Switch
          id="rv-status"
          checked={settings.statusPageEnabled}
          disabled={channelDisabled}
          onCheckedChange={(v) => patch({ statusPageEnabled: v })}
          label="Értékelés kérése a státusz oldalon"
          description="Kész, átvehető: az oldal alján, a Hívás gomb után. Átadva: kiemelve. Visszatérő vevőnek erősebb szöveg."
        />
        <SettingsLink href="/beallitasok/sms">Előnézet az SMS sablonoknál</SettingsLink>
      </FormSection>

      <FormSection
        title="2. QR-kód az átvételi blokkon"
        description="A vevői példány aljára kerül. Átadáskor, a pultnál a legjobb pillanat. Ha mellé szóban is kéred, még jobb."
        columns={1}
      >
        <Switch
          id="rv-qr"
          checked={settings.handoverQrEnabled}
          disabled={channelDisabled}
          onCheckedChange={(v) => patch({ handoverQrEnabled: v })}
          label="QR-kód a vevői példányon"
          description="Ha csak üzleti példányt nyomtatsz, nem jelenik meg."
        />
        {settings.handoverQrEnabled ? (
          <FormField
            label="Szöveg a QR-kód fölött"
            htmlFor="rv-qr-text"
            error={fieldErrors.handoverQrText}
            hint={`${settings.handoverQrText.length}/${HANDOVER_QR_TEXT_MAX} karakter`}
          >
            <Input
              id="rv-qr-text"
              value={settings.handoverQrText}
              maxLength={HANDOVER_QR_TEXT_MAX}
              disabled={channelDisabled}
              onChange={(e) => patch({ handoverQrText: e.target.value })}
            />
          </FormField>
        ) : null}
        <SettingsLink href="/beallitasok/atveteli-blokk">Előnézet az Átvételi blokknál</SettingsLink>
      </FormSection>

      <FormSection
        title="3. Köszönő SMS átadás után"
        description="Ez hozza a legtöbb értékelést, de SMS-díjjal jár. Csak hozzájáruló vevőknek megy."
        columns={1}
      >
        {!hasSms ? (
          <p className="flex items-center gap-1.5 rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink-secondary">
            <Lock className="size-4 shrink-0" aria-hidden />
            SMS add-on szükséges (készre jelentés SMS vagy ügyfélrendelés).
          </p>
        ) : (
          <>
            <Switch
              id="rv-sms"
              checked={settings.thankSmsEnabled}
              disabled={channelDisabled}
              onCheckedChange={(v) => patch({ thankSmsEnabled: v })}
              label="Köszönő SMS értékelés-kéréssel"
              description="Lapszabászat és ügyfélrendelés átadása után, egyszer."
            />

            {settings.thankSmsEnabled ? (
              <div className="space-y-3">
                <fieldset>
                  <legend className="text-label text-ink">Mikor menjen ki?</legend>
                  <div role="radiogroup" className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {THANK_SMS_TIMING_OPTIONS.map((opt) => {
                      const selected = settings.thankSmsTiming === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={channelDisabled}
                          onClick={() => patch({ thankSmsTiming: opt.value })}
                          className={cn(
                            'rounded-md border px-3 py-2 text-left transition-colors duration-fast disabled:opacity-50',
                            selected
                              ? 'border-primary bg-subtle ring-1 ring-primary'
                              : 'border-border hover:bg-subtle'
                          )}
                        >
                          <span className="block text-label text-ink">{opt.label}</span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">{opt.hint}</span>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <ul className="list-disc space-y-1 pl-5 text-body text-ink-secondary">
                  <li>
                    Csak annak megy, akinél az ügyféladatlapon be van kapcsolva az{' '}
                    <span className="text-ink">Értékelés-kérő SMS</span>. Most:{' '}
                    <span className="font-medium tabular-nums text-ink">
                      {nf.format(thankSms.consentCustomers)} vevő
                    </span>
                    .
                  </li>
                  <li>Csak 9 és 19 óra között küldjük.</li>
                  <li>Ha a vevő a státusz oldalon már rákattintott, nem küldjük.</li>
                </ul>

                <p className="text-hint text-ink-secondary">
                  Elküldve az utolsó 30 napban:{' '}
                  <span className="tabular-nums text-ink">{nf.format(thankSms.sent30d)} SMS</span>
                  {' · '}Ütemezve:{' '}
                  <span className="tabular-nums text-ink">{nf.format(thankSms.pending)}</span>
                </p>
                <p className="text-hint text-ink-secondary">
                  Az értékelés-kérés reklám jellegű megkeresésnek minősülhet, ezért csak kifejezett
                  hozzájárulással küldjük. Kedvezményt vagy ajándékot értékelésért a Google tilt.
                </p>
              </div>
            ) : null}
            <SettingsLink href="/beallitasok/sms#review-thanks">Szöveg szerkesztése az SMS sablonoknál</SettingsLink>
          </>
        )}
      </FormSection>

      {hasPartnerPortal ? (
        <FormSection
          title="4. Partnerportál"
          description="A partnereid kezdőlapján, ha az elmúlt 30 napban átvettek tőled rendelést. Ingyenes, hozzájárulás nem kell hozzá."
          columns={1}
        >
          {!partnerStats.available ? (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
              Ehhez futtasd a{' '}
              <code className="text-hint">20261007_partner_review_prompts.sql</code> migrációt.
            </p>
          ) : null}
          <Switch
            id="rv-partner"
            checked={settings.partnerPortalEnabled}
            disabled={channelDisabled || !partnerStats.available}
            onCheckedChange={(v) => patch({ partnerPortalEnabled: v })}
            label="Értékelés kérése a partner kezdőlapon"
            description="Egy kártya a csempék alatt. A partner elhalaszthatja, vagy jelezheti, hogy már írt."
          />
          <ul className="list-disc space-y-1 pl-5 text-body text-ink-secondary">
            <li>Egyszerre csak egy kérést lát: ilyenkor a Turinova elégedettségi kérdés vár.</li>
            <li>„Most nem” után 30, majd 90 napig nem kérdezzük, harmadszorra már nem.</li>
            <li>„Már írtam” után ennél a partnernél többet nem jelenik meg.</li>
          </ul>
          {partnerStats.available ? (
            <p className="text-hint text-ink-secondary">
              Partnerek, akik jelezték, hogy írtak:{' '}
              <span className="tabular-nums text-ink">{nf.format(partnerStats.selfReported)}</span>
            </p>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection
        title="Gyakoriság"
        description={
          hasPartnerPortal
            ? 'Ne kérjük túl gyakran ugyanazt a vevőt. A státusz oldalra, a köszönő SMS-re és a partner kezdőlapra vonatkozik, a QR-kód minden blokkon ott van.'
            : 'Ne kérjük túl gyakran ugyanazt a vevőt. A státusz oldalra és a köszönő SMS-re vonatkozik, a QR-kód minden blokkon ott van.'
        }
        columns={2}
      >
        <FormField label="Ugyanazt a vevőt legfeljebb" htmlFor="rv-frequency">
          <MenuSelect
            id="rv-frequency"
            value={String(settings.frequencyDays)}
            allowEmpty={false}
            disabled={disabled}
            options={REVIEW_FREQUENCY_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
            onChange={(v) => patch({ frequencyDays: Number(v) as ReviewFrequencyDays })}
          />
        </FormField>
      </FormSection>
    </div>
  )
}
