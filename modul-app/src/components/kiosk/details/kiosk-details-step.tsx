'use client'

import { AlertCircle, Info } from 'lucide-react'
import { useId, useMemo, useState, type CSSProperties } from 'react'

import { CartPanelThumb } from '@/components/kiosk/cart/cart-panel-thumb'
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
import { edgeCartChips } from '@/lib/kiosk/mock-pricing'
import type {
  KioskBillingMode,
  KioskCartLine,
  KioskGuest,
  KioskGuestBilling
} from '@/lib/kiosk/types'
import { cn } from '@/lib/utils'

type SectionId = 'contact' | 'billing' | 'consent'

type DetailsSheet = {
  id: string
  name: string
  thicknessMm: number
  swatch?: string
  imageUrl?: string | null
  grainDirection?: boolean
}

const FIELD_SELECTOR = '[data-kiosk-field]'

/** 24″ Adatok: 50+ olvasható — 64 px mező, címke a mező felett. */
const inputClass =
  'h-16 rounded-lg px-4 text-[22px] focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15'

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

function sheetFillStyle(
  sheet: Pick<DetailsSheet, 'imageUrl' | 'swatch'> | undefined
): CSSProperties {
  if (sheet?.imageUrl) {
    return {
      backgroundImage: `url(${sheet.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#e4e4e7'
    }
  }
  return { background: sheet?.swatch ?? 'var(--color-subtle)' }
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
  sheets: DetailsSheet[]
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <aside
        className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b border-border bg-surface px-6 py-6 md:px-8 lg:h-full lg:w-[720px] lg:border-b-0 lg:border-r lg:py-7"
        onKeyDown={handleEnterNext}
      >
        <header className="space-y-1">
          <h1 className="text-[36px] font-semibold leading-tight tracking-tight text-ink lg:text-[40px]">
            Add meg az adataidat
          </h1>
          <p className="text-[18px] leading-snug text-ink-secondary">
            Leadás itt · fizetés a pultnál.
          </p>
        </header>

        <KioskSection
          index={1}
          title="Elérhetőség"
          description="A pult a neved alapján talál meg."
          state={sectionState('contact', validation.contactDone)}
          onFocusWithin={() => enterSection('contact')}
          onHeaderClick={() => enterSection('contact')}
        >
          <div className="space-y-4">
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
                  className="h-11 text-[15px] font-semibold"
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
          bodyClassName={
            billingMode === 'here'
              ? 'max-h-[min(48vh,26rem)] overflow-y-auto'
              : undefined
          }
          onFocusWithin={() => enterSection('billing')}
          onHeaderClick={() => enterSection('billing')}
        >
          <fieldset>
            <legend className="sr-only">Kérsz számlát?</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {BILLING_OPTIONS.map((opt) => {
                const checked = billingMode === opt.id
                return (
                  <label
                    key={opt.id}
                    className={cn(
                      'flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3.5 transition-colors',
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
                      <span className="block text-[18px] font-semibold text-ink">
                        {opt.title}
                      </span>
                      <span className="block text-[16px] text-ink-secondary">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {billingMode === 'here' ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
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
              <FormRow label="Adószám" optional hint="Csak cégnél.">
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
                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2.5">
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
                    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2.5">
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

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              className="h-11 text-[15px] font-semibold"
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
          onFocusWithin={() => enterSection('consent')}
          onHeaderClick={() => enterSection('consent')}
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3.5 transition-colors',
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
              <span className="block text-[18px] font-semibold text-ink">
                Átnéztem a rendelésemet
              </span>
              <span className="mt-0.5 block text-[16px] leading-snug text-ink-secondary">
                Lapok, méretek, élzárás stimmel. A pultnál még lehet
                módosítani.
              </span>
            </span>
          </label>
        </KioskSection>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-app px-6 py-6 md:px-8 lg:h-full lg:py-7">
        <div className="flex w-full flex-col gap-4">
          <OrderReceipt
            cart={cart}
            sheets={sheets}
            totalGross={totalGross}
            onEditCart={onEditCart}
          />
          <div className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
            <Info
              className="mt-0.5 size-5 shrink-0 text-ink-secondary"
              aria-hidden
            />
            <p className="text-[16px] leading-snug text-ink-secondary">
              <span className="font-semibold text-ink">Elakadtál?</span> Szólj
              a pultnál.
            </p>
          </div>
        </div>
      </section>
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[18px] font-semibold text-ink">
        {label}
        {optional ? (
          <span className="ml-2 text-[15px] font-medium text-ink-secondary">
            nem kötelező
          </span>
        ) : null}
      </label>
      <div className="min-w-0 space-y-1.5">
        {children(id, describedBy)}
        {error ? (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-[16px] font-medium text-danger-ink"
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[16px] text-ink-secondary">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function OrderReceipt({
  cart,
  sheets,
  totalGross,
  onEditCart
}: {
  cart: KioskCartLine[]
  sheets: DetailsSheet[]
  totalGross: number
  onEditCart: () => void
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        sheetId: string
        sheet: DetailsSheet | undefined
        rows: KioskCartLine[]
      }
    >()
    for (const line of cart) {
      const existing = map.get(line.sheetId)
      if (existing) {
        existing.rows.push(line)
      } else {
        map.set(line.sheetId, {
          sheetId: line.sheetId,
          sheet: sheets.find((s) => s.id === line.sheetId),
          rows: [line]
        })
      }
    }
    return Array.from(map.values())
  }, [cart, sheets])

  const pieces = cart.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-[24px] font-semibold text-ink">Rendelésed</h2>
          <p className="text-[18px] tabular-nums text-ink-secondary">
            {cart.length} tétel · {pieces} db · {groups.length} anyag
          </p>
        </div>
      </header>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {groups.map((group) => {
          const s = group.sheet
          const fill = sheetFillStyle(s)
          return (
            <div
              key={group.sheetId}
              className="rounded-xl border border-border bg-app/60 px-4 py-4"
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="size-12 shrink-0 rounded-lg border border-border"
                  style={fill}
                  aria-hidden
                />
                <p className="min-w-0 line-clamp-2 text-[18px] font-semibold leading-snug text-ink">
                  {s ? `${s.name} · ${s.thicknessMm} mm` : 'Bútorlap'}
                </p>
              </div>
              <ul className="space-y-3">
                {group.rows.map((line) => (
                  <ReceiptLine
                    key={line.id}
                    line={line}
                    fillStyle={fill}
                    grainDirection={Boolean(s?.grainDirection)}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="space-y-3 border-t-2 border-ink px-6 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[18px] font-semibold text-ink">Összesen</p>
            <p className="text-[16px] text-ink-secondary">
              Bruttó · fizetés a pultnál
            </p>
          </div>
          <p className="text-[44px] font-semibold tabular-nums leading-none text-success-ink md:text-[48px]">
            {totalGross > 0 ? formatHuf(totalGross) : '—'}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-14 w-full text-[17px] font-semibold"
          onClick={onEditCart}
        >
          Kosár módosítása
        </Button>
      </div>
    </div>
  )
}

function ReceiptLine({
  line,
  fillStyle,
  grainDirection
}: {
  line: KioskCartLine
  fillStyle: CSSProperties
  grainDirection: boolean
}) {
  const chips = machiningSummaryChips(line.machining)
  const edgeChips = edgeCartChips(line.edgeIds)
  const label = line.label?.trim()

  return (
    <li className="flex items-start gap-3">
      <CartPanelThumb
        grainMm={line.grainMm}
        crossMm={line.crossMm}
        machining={line.machining}
        fillStyle={fillStyle}
        grainDirection={grainDirection}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1">
        {label ? (
          <p className="line-clamp-2 text-[17px] font-semibold text-ink">
            {label}
          </p>
        ) : null}
        <p className="text-[17px] tabular-nums text-ink">
          {line.grainMm} × {line.crossMm} mm · {line.quantity} db
        </p>
        {(chips.length > 0 || edgeChips.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded bg-ink px-2 py-0.5 text-[15px] font-medium text-white"
              >
                {chip}
              </span>
            ))}
            {edgeChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex max-w-full truncate rounded border border-border bg-white px-2 py-0.5 text-[15px] text-ink"
                title={`${c.badge} · ${c.name}`}
              >
                {c.badge} · {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}
