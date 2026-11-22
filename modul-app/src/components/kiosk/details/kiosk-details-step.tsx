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
import { formatHuf } from '@/lib/kiosk/mock-data'
import type {
  KioskBillingMode,
  KioskCartLine,
  KioskGuest,
  KioskGuestBilling
} from '@/lib/kiosk/types'
import { cn } from '@/lib/utils'

type SectionId = 'contact' | 'billing' | 'consent'

const FIELD_SELECTOR = '[data-kiosk-field]'

const inputClass =
  'h-14 rounded-lg px-4 text-[18px] focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15'

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
    description: 'Név, cím és ha cég, adószám.'
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
    <div className="mx-auto w-full max-w-6xl pb-4">
      <header className="mb-6 space-y-1.5">
        <p className="text-[15px] font-semibold text-ink-secondary">
          Utolsó lépés
        </p>
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink">
          Add meg az adataidat
        </h1>
        <p className="text-[18px] leading-snug text-ink-secondary">
          Itt a rendelést adod le. Fizetni a pultnál fogsz.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4" onKeyDown={handleEnterNext}>
          <KioskSection
            index={1}
            title="Elérhetőség"
            description="A pultnál a neved alapján találjuk meg a rendelésed."
            state={sectionState('contact', validation.contactDone)}
            onFocusWithin={() => enterSection('contact')}
          >
            <div className="space-y-5">
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
                label="Telefonszám"
                hint="Ide küldjük az SMS-t, ha elkészült a gyártás. Reklámot nem küldünk."
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
                    onBlur={() => touch('email')}
                    onChange={(e) =>
                      onChange({ ...guest, email: e.target.value })
                    }
                  />
                )}
              </FormRow>
            </div>
          </KioskSection>

          <KioskSection
            index={2}
            title="Számla"
            description="Csak ha számlát kérsz."
            state={sectionState('billing', validation.billingDone)}
            onFocusWithin={() => enterSection('billing')}
          >
            <fieldset>
              <legend className="sr-only">Kérsz számlát?</legend>
              <div className="space-y-2.5">
                {BILLING_OPTIONS.map((opt) => {
                  const checked = billingMode === opt.id
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex min-h-16 cursor-pointer items-center gap-4 rounded-lg border px-4 py-3 transition-colors',
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
                        className="size-6 shrink-0 accent-ink"
                        onChange={() =>
                          onChange({ ...guest, billingMode: opt.id })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-[17px] font-semibold text-ink">
                          {opt.title}
                        </span>
                        <span className="block text-[15px] text-ink-secondary">
                          {opt.description}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {billingMode === 'here' ? (
              <div className="mt-5 space-y-5 border-t border-border pt-5">
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
                  hint="Csak ha cégre kéred."
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
                    <div className="space-y-3">
                      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
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
                      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
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
          </KioskSection>

          <KioskSection
            index={3}
            title="Ellenőrzés"
            description="Leadás előtt nézd át még egyszer a rendelésed."
            state={sectionState('consent', validation.consentDone)}
            onFocusWithin={() => enterSection('consent')}
          >
            <label
              className={cn(
                'flex cursor-pointer items-start gap-4 rounded-lg border px-4 py-4 transition-colors',
                guest.consent
                  ? 'border-ink bg-subtle'
                  : 'border-border hover:border-border-strong'
              )}
            >
              <input
                type="checkbox"
                data-kiosk-field
                className="mt-0.5 size-7 shrink-0 accent-ink"
                checked={guest.consent}
                onChange={(e) =>
                  onChange({ ...guest, consent: e.target.checked })
                }
              />
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold text-ink">
                  Átnéztem a rendelésemet
                </span>
                <span className="mt-1 block text-[16px] leading-snug text-ink-secondary">
                  A lapok, a méretek és az élzárás úgy szerepelnek, ahogy
                  kérem. Ha mégis változtatnál, a pultnál még megteheted.
                </span>
              </span>
            </label>
          </KioskSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <OrderSummaryCard
            cart={cart}
            sheets={sheets}
            totalGross={totalGross}
            onEditCart={onEditCart}
          />
          <div className="flex gap-3 rounded-xl border border-border bg-surface px-5 py-4">
            <Info
              className="mt-0.5 size-5 shrink-0 text-ink-secondary"
              aria-hidden
            />
            <p className="text-[15px] leading-snug text-ink-secondary">
              <span className="font-semibold text-ink">Elakadtál?</span> Szólj
              a pultnál. Segítünk befejezni.
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
    <div className="grid gap-x-5 gap-y-2 lg:grid-cols-[9.5rem_minmax(0,1fr)]">
      <label
        htmlFor={id}
        className="text-[17px] font-semibold leading-tight text-ink lg:pt-4"
      >
        {label}
        {optional ? (
          <span className="mt-0.5 block text-[14px] font-medium text-ink-secondary">
            nem kötelező
          </span>
        ) : null}
      </label>
      <div className="min-w-0 space-y-2">
        {children(id, describedBy)}
        {error ? (
          <p
            id={errorId}
            className="flex items-start gap-2 text-[15px] font-medium text-danger-ink"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[15px] text-ink-secondary">
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
        return {
          id: line.id,
          title: sheet
            ? `${sheet.name} · ${sheet.thicknessMm} mm`
            : 'Bútorlap',
          meta: [
            line.label?.trim() || null,
            `${line.grainMm} × ${line.crossMm} mm`,
            `${line.quantity} db`
          ]
            .filter(Boolean)
            .join(' · ')
        }
      }),
    [cart, sheets]
  )
  const visible = rows.slice(0, 4)
  const more = rows.length - visible.length
  const pieces = cart.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <KioskSection
      title="Rendelésed"
      description={`${cart.length} tétel · ${pieces} darab`}
      action={
        <Button
          type="button"
          variant="secondary"
          className="h-11 px-4 text-[15px] font-semibold"
          onClick={onEditCart}
        >
          Módosítás
        </Button>
      }
    >
      <ul className="-mt-1 divide-y divide-border">
        {visible.map((row) => (
          <li key={row.id} className="py-3 first:pt-0">
            <p className="text-[16px] font-semibold leading-snug text-ink">
              {row.title}
            </p>
            <p className="mt-0.5 text-[15px] tabular-nums text-ink-secondary">
              {row.meta}
            </p>
          </li>
        ))}
        {more > 0 ? (
          <li className="py-3 text-[15px] font-medium text-ink-secondary">
            + {more} további tétel
          </li>
        ) : null}
      </ul>
      <div className="mt-2 border-t-2 border-ink pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-semibold text-ink">Összesen</span>
          <span className="text-[28px] font-semibold tabular-nums leading-none text-ink">
            {totalGross > 0 ? formatHuf(totalGross) : 'nincs'}
          </span>
        </div>
        <p className="mt-2 text-[15px] text-ink-secondary">Bruttó ár</p>
      </div>
    </KioskSection>
  )
}
