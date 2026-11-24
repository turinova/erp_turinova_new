'use client'

import { AlertCircle, Info } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { KioskSection } from '@/components/kiosk/details/kiosk-section'
import type { KioskSectionState } from '@/components/kiosk/details/kiosk-section'
import { PhoneInput } from '@/components/patterns/phone-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTaxNumber } from '@/lib/customers/parse'
import {
  isBillingFormValid,
  isGuestEmailValid,
  isGuestNameValid,
  isGuestPhoneValid,
  validateKioskGuest
} from '@/lib/kiosk/guest'
import { machiningSummaryChips } from '@/lib/kiosk/machining-copy'
import { formatHuf } from '@/lib/kiosk/mock-data'
import { edgeSummaryLabel } from '@/lib/kiosk/mock-pricing'
import type {
  KioskBillingMode,
  KioskCartLine,
  KioskGuest,
  KioskGuestBilling
} from '@/lib/kiosk/types'
import { cn } from '@/lib/utils'

type SectionId = 'contact' | 'billing' | 'consent'

const FIELD_SELECTOR = '[data-kiosk-field]'

/** 24″ Adatok: sűrűbb mezők, hogy ne kelljen scroll. */
const inputClass =
  'h-12 rounded-lg px-3.5 text-[17px] focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15'

const BILLING_OPTIONS: Array<{
  id: KioskBillingMode
  title: string
  description: string
}> = [
  {
    id: 'none',
    title: 'Nem kell számla',
    description: 'Nyugtát kapsz a pultnál.'
  },
  {
    id: 'here',
    title: 'Kérek számlát',
    description: 'Név, cím, adószám ha cég.'
  }
]

/** Enter → következő mező (asztali billentyűzet). */
function handleEnterNext(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return
  const target = e.target as HTMLElement
  if (!(target instanceof HTMLInputElement)) return
  if (target.type === 'checkbox' || target.type === 'radio') return
  e.preventDefault()
  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(FIELD_SELECTOR)
  ).filter((el) => !el.hasAttribute('disabled'))
  const idx = fields.indexOf(target)
  fields[idx + 1]?.focus()
}

export function KioskDetailsStep({
  guest,
  cart,
  sheets,
  totalGross,
  onChange,
  onEditCart
}: {
  guest: KioskGuest
  cart: KioskCartLine[]
  sheets: Array<{ id: string; name: string; thicknessMm: number }>
  totalGross: number
  onChange: (g: KioskGuest) => void
  onEditCart: () => void
}) {
  const [active, setActive] = useState<SectionId>('contact')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  /** Default: nincs számla. Régi / hiányzó érték → none. */
  const billingMode: KioskBillingMode =
    guest.billingMode === 'here' ? 'here' : 'none'
  const validation = validateKioskGuest({ ...guest, billingMode })

  function touch(key: string) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }))
  }

  function patchBilling(patch: Partial<KioskGuestBilling>) {
    onChange({ ...guest, billing: { ...guest.billing, ...patch } })
  }

  function enterSection(id: SectionId) {
    if (active === 'billing' && id !== 'billing') touch('billing')
    setActive(id)
  }

  function sectionState(id: SectionId, done: boolean): KioskSectionState {
    if (active === id) return 'active'
    return done ? 'done' : 'todo'
  }

  const nameError =
    touched.name && !isGuestNameValid(guest.name)
      ? 'Írd be a neved (legalább 2 betű).'
      : null
  const phoneError =
    touched.phone && !isGuestPhoneValid(guest.phone)
      ? 'Teljes mobilszám kell, pl. +36 30 123 4567.'
      : null
  const emailError =
    touched.email && !isGuestEmailValid(guest.email)
      ? 'Ez nem tűnik e-mail címnek. Javítsd, vagy hagyd üresen.'
      : null
  const billingError =
    touched.billing &&
    billingMode === 'here' &&
    !isBillingFormValid(guest.billing)
      ? 'Név, irányítószám (4 jegy), város, utca és házszám kell.'
      : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-ink md:text-[26px]">
            Add meg az adataidat
          </h1>
          <p className="mt-0.5 text-[15px] leading-snug text-ink-secondary">
            Leadás itt · fizetés a pultnál.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-2.5" onKeyDown={handleEnterNext}>
          <KioskSection
            index={1}
            title="Elérhetőség"
            description="A pult a neved alapján talál meg."
            state={sectionState('contact', validation.contactDone)}
            compact
            onFocusWithin={() => enterSection('contact')}
            onHeaderClick={() => enterSection('contact')}
          >
            <div className="space-y-3">
              <FormRow label="Neved" error={nameError}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    data-kiosk-field
                    name="kiosk-guest-name"
                    autoComplete="off"
                    autoFocus
                    enterKeyHint="next"
                    placeholder="pl. Kovács Péter"
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={describedBy}
                    className={cn(inputClass, nameError && 'border-danger')}
                    value={guest.name}
                    onBlur={() => touch('name')}
                    onChange={(e) =>
                      onChange({ ...guest, name: e.target.value })
                    }
                  />
                )}
              </FormRow>

              <FormRow
                label="Telefon"
                hint="SMS, ha kész a gyártás."
                error={phoneError}
              >
                {(id, describedBy) => (
                  <PhoneInput
                    id={id}
                    data-kiosk-field
                    name="kiosk-guest-phone"
                    autoComplete="off"
                    enterKeyHint="next"
                    aria-invalid={Boolean(phoneError)}
                    aria-describedby={describedBy}
                    className={cn(
                      inputClass,
                      'tabular-nums',
                      phoneError && 'border-danger'
                    )}
                    value={guest.phone || '+36'}
                    onBlur={() => touch('phone')}
                    onValueChange={(phone) =>
                      onChange({
                        ...guest,
                        phone: phone.trim() === '' ? '+36' : phone
                      })
                    }
                  />
                )}
              </FormRow>

              <FormRow label="E-mail" optional error={emailError}>
                {(id, describedBy) => (
                  <Input
                    id={id}
                    data-kiosk-field
                    type="email"
                    name="kiosk-guest-email"
                    autoComplete="off"
                    inputMode="email"
                    enterKeyHint="next"
                    placeholder="nev@pelda.hu"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={describedBy}
                    className={cn(inputClass, emailError && 'border-danger')}
                    value={guest.email}
                    onBlur={() => {
                      touch('email')
                      if (
                        isGuestNameValid(guest.name) &&
                        isGuestPhoneValid(guest.phone) &&
                        isGuestEmailValid(guest.email)
                      ) {
                        enterSection('billing')
                      }
                    }}
                    onChange={(e) =>
                      onChange({ ...guest, email: e.target.value })
                    }
                  />
                )}
              </FormRow>

              {validation.contactDone ? (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 text-[14px] font-semibold"
                    onClick={() => enterSection('billing')}
                  >
                    Tovább a számlához →
                  </Button>
                </div>
              ) : null}
            </div>
          </KioskSection>

          <KioskSection
            index={2}
            title="Számla"
            description="Csak ha számlát kérsz."
            state={sectionState('billing', validation.billingDone)}
            compact
            bodyClassName={
              billingMode === 'here'
                ? 'max-h-[min(42vh,22rem)] overflow-y-auto'
                : undefined
            }
            onFocusWithin={() => enterSection('billing')}
            onHeaderClick={() => enterSection('billing')}
          >
            <fieldset>
              <legend className="sr-only">Kérsz számlát?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {BILLING_OPTIONS.map((opt) => {
                  const checked = billingMode === opt.id
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                        checked
                          ? 'border-ink bg-subtle'
                          : 'border-border hover:border-border-strong'
                      )}
                    >
                      <input
                        type="radio"
                        name="kiosk-billing-mode"
                        value={opt.id}
                        checked={checked}
                        className="size-5 shrink-0 accent-ink"
                        onChange={() =>
                          onChange({ ...guest, billingMode: opt.id })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-ink">
                          {opt.title}
                        </span>
                        <span className="block text-[13px] text-ink-secondary">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {billingMode === 'here' ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <FormRow label="Számlázási név">
                  {(id) => (
                    <Input
                      id={id}
                      data-kiosk-field
                      name="kiosk-billing-name"
                      autoComplete="off"
                      enterKeyHint="next"
                      placeholder="Magánszemély vagy cég neve"
                      className={inputClass}
                      value={guest.billing.name}
                      onChange={(e) => patchBilling({ name: e.target.value })}
                    />
                  )}
                </FormRow>
                <FormRow
                  label="Adószám"
                  optional
                  hint="Csak cégnél."
                >
                  {(id, describedBy) => (
                    <Input
                      id={id}
                      data-kiosk-field
                      name="kiosk-billing-tax"
                      autoComplete="off"
                      inputMode="numeric"
                      enterKeyHint="next"
                      placeholder="12345678-1-42"
                      aria-describedby={describedBy}
                      className={cn(inputClass, 'tabular-nums')}
                      value={guest.billing.taxNumber}
                      onChange={(e) =>
                        patchBilling({
                          taxNumber: formatTaxNumber(e.target.value)
                        })
                      }
                    />
                  )}
                </FormRow>
                <FormRow label="Cím" error={billingError}>
                  {(id, describedBy) => (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2.5">
                        <Input
                          id={id}
                          data-kiosk-field
                          name="kiosk-billing-zip"
                          autoComplete="off"
                          inputMode="numeric"
                          enterKeyHint="next"
                          maxLength={4}
                          placeholder="Irsz."
                          aria-label="Irányítószám"
                          aria-describedby={describedBy}
                          className={cn(inputClass, 'tabular-nums')}
                          value={guest.billing.postalCode}
                          onChange={(e) =>
                            patchBilling({
                              postalCode: e.target.value
                                .replace(/\D/g, '')
                                .slice(0, 4)
                            })
                          }
                        />
                        <Input
                          data-kiosk-field
                          name="kiosk-billing-city"
                          autoComplete="off"
                          enterKeyHint="next"
                          placeholder="Város"
                          aria-label="Város"
                          className={inputClass}
                          value={guest.billing.city}
                          onChange={(e) =>
                            patchBilling({ city: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2.5">
                        <Input
                          data-kiosk-field
                          name="kiosk-billing-street"
                          autoComplete="off"
                          enterKeyHint="next"
                          placeholder="Utca"
                          aria-label="Utca"
                          className={inputClass}
                          value={guest.billing.street}
                          onChange={(e) =>
                            patchBilling({ street: e.target.value })
                          }
                        />
                        <Input
                          data-kiosk-field
                          name="kiosk-billing-house"
                          autoComplete="off"
                          enterKeyHint="next"
                          placeholder="Házszám"
                          aria-label="Házszám"
                          className={inputClass}
                          value={guest.billing.houseNumber}
                          onChange={(e) =>
                            patchBilling({ houseNumber: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </FormRow>
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                className="h-10 text-[14px] font-semibold"
                disabled={!validation.billingDone}
                onClick={() => enterSection('consent')}
              >
                Tovább az ellenőrzéshez →
              </Button>
            </div>
          </KioskSection>

          <KioskSection
            index={3}
            title="Ellenőrzés"
            description="Leadás előtt egy pipa."
            state={sectionState('consent', validation.consentDone)}
            compact
            onFocusWithin={() => enterSection('consent')}
            onHeaderClick={() => enterSection('consent')}
          >
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
                guest.consent
                  ? 'border-ink bg-subtle'
                  : 'border-border hover:border-border-strong'
              )}
            >
              <input
                type="checkbox"
                data-kiosk-field
                className="mt-0.5 size-6 shrink-0 accent-ink"
                checked={guest.consent}
                onChange={(e) =>
                  onChange({ ...guest, consent: e.target.checked })
                }
              />
              <span className="min-w-0">
                <span className="block text-[16px] font-semibold text-ink">
                  Átnéztem a rendelésemet
                </span>
                <span className="mt-0.5 block text-[14px] leading-snug text-ink-secondary">
                  Lapok, méretek, élzárás stimmel. A pultnál még lehet
                  módosítani.
                </span>
              </span>
            </label>
          </KioskSection>
        </div>

        <aside className="space-y-2.5 lg:sticky lg:top-2">
          <OrderSummaryCard
            cart={cart}
            sheets={sheets}
            totalGross={totalGross}
            onEditCart={onEditCart}
          />
          <div className="flex gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3">
            <Info
              className="mt-0.5 size-4 shrink-0 text-ink-secondary"
              aria-hidden
            />
            <p className="text-[13px] leading-snug text-ink-secondary">
              <span className="font-semibold text-ink">Elakadtál?</span> Szólj
              a pultnál.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function FormRow({
  label,
  optional,
  hint,
  error,
  children
}: {
  label: string
  optional?: boolean
  hint?: string
  error?: string | null
  children: (id: string, describedBy: string | undefined) => React.ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="grid gap-x-4 gap-y-1.5 lg:grid-cols-[7.5rem_minmax(0,1fr)]">
      <label
        htmlFor={id}
        className="text-[15px] font-semibold leading-tight text-ink lg:pt-3"
      >
        {label}
        {optional ? (
          <span className="mt-0.5 block text-[12px] font-medium text-ink-secondary">
            nem kötelező
          </span>
        ) : null}
      </label>
      <div className="min-w-0 space-y-1.5">
        {children(id, describedBy)}
        {error ? (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-[13px] font-medium text-danger-ink"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[13px] text-ink-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function OrderSummaryCard({
  cart,
  sheets,
  totalGross,
  onEditCart
}: {
  cart: KioskCartLine[]
  sheets: Array<{ id: string; name: string; thicknessMm: number }>
  totalGross: number
  onEditCart: () => void
}) {
  const rows = useMemo(
    () =>
      cart.map((line) => {
        const sheet = sheets.find((s) => s.id === line.sheetId)
        const edgeLabel = edgeSummaryLabel(line.edgeIds)
        const chips: string[] = []
        if (edgeLabel !== 'Nincs él') chips.push(edgeLabel)
        chips.push(...machiningSummaryChips(line.machining))
        return {
          id: line.id,
          title: sheet
            ? `${sheet.name} · ${sheet.thicknessMm} mm`
            : 'Bútorlap',
          meta: [
            `${line.grainMm} × ${line.crossMm} mm`,
            `${line.quantity} db`,
            line.label?.trim() || null
          ]
            .filter(Boolean)
            .join(' · '),
          chips
        }
      }),
    [cart, sheets]
  )
  const visible = rows.slice(0, 3)
  const more = rows.length - visible.length
  const pieces = cart.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <KioskSection
      title="Rendelésed"
      description={`${cart.length} tétel · ${pieces} db`}
      forceOpen
      compact
      action={
        <Button
          type="button"
          variant="secondary"
          className="h-9 px-3 text-[13px] font-semibold"
          onClick={onEditCart}
        >
          Módosítás
        </Button>
      }
    >
      <ul className="-mt-0.5 divide-y divide-border">
        {visible.map((row) => (
          <li key={row.id} className="py-2 first:pt-0">
            <p className="truncate text-[14px] font-semibold leading-snug text-ink">
              {row.title}
            </p>
            <p className="mt-0.5 truncate text-[13px] tabular-nums text-ink-secondary">
              {row.meta}
            </p>
            {row.chips.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {row.chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-block max-w-full truncate rounded border border-border bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink"
                    title={chip}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {more > 0 ? (
          <li className="py-2 text-[13px] font-medium text-ink-secondary">
            + {more} további tétel
          </li>
        ) : null}
      </ul>
      <div className="mt-1.5 border-t-2 border-ink pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-ink">Összesen</span>
          <span className="text-[22px] font-semibold tabular-nums leading-none text-success-ink">
            {totalGross > 0 ? formatHuf(totalGross) : 'nincs'}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-ink-secondary">Bruttó</p>
      </div>
    </KioskSection>
  )
}
