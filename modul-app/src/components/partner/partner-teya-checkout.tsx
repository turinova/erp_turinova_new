'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Lock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import { PARTNER_ORDERS_PATH, PARTNER_SETTINGS_PATH } from '@/lib/auth/surface'
import { usePartnerHref } from '@/lib/auth/use-partner-href'
import { formatQuotePrice } from '@/lib/opti/quote-calculations'
import { createPartnerTeyaCheckoutSession } from '@/lib/teya-online/partner-checkout'
import { cn } from '@/lib/utils'

/** Teya endorsement (guideline: charcoal + lime) — secondary, not page hero. */
const TEYA = {
  charcoal: '#151515',
  lime: '#dde048',
  blue: '#0055ff'
} as const

export type PartnerTeyaCheckoutProps = {
  quoteId: string
  quoteNumber: string
  orderNumber: string | null
  projectName: string | null
  amountHintHuf: number
  companyLabel: string
  paymentMethodName: string | null
  billingName: string | null
  billingLine: string | null
  partnerName: string
}

function FactRow({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-body font-medium text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-ink-secondary transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="pb-3 text-hint text-ink-secondary">{children}</div>
    </details>
  )
}

export function PartnerTeyaCheckout({
  quoteId,
  quoteNumber,
  orderNumber,
  projectName,
  amountHintHuf,
  companyLabel,
  paymentMethodName,
  billingName,
  billingLine,
  partnerName
}: PartnerTeyaCheckoutProps) {
  const partnerHref = usePartnerHref()
  const router = useRouter()
  const mountRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef<{ destroy: () => void } | null>(null)
  const mountId = useId()
  const [pending, startTransition] = useTransition()
  const [bootError, setBootError] = useState<string | null>(null)
  const [billingLink, setBillingLink] = useState(false)
  const [amountHuf, setAmountHuf] = useState(amountHintHuf)
  const [ready, setReady] = useState(false)
  const [paidHint, setPaidHint] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    startTransition(() => {
      void (async () => {
        setBootError(null)
        setBillingLink(false)
        setPaidHint(false)
        setReady(false)

        const session = await createPartnerTeyaCheckoutSession(quoteId)
        if (cancelled) return

        if (!session.ok) {
          setBootError(session.message)
          setBillingLink(session.code === 'billing_incomplete')
          if (session.code === 'already_paid') {
            setPaidHint(true)
          }
          return
        }

        setAmountHuf(session.amountHuf)
        const amountLabel = formatQuotePrice(session.amountHuf)

        try {
          const { initTeyaBlocks } = await import('@teyaproduct/teya-blocks-js')
          const teya = await initTeyaBlocks(session.sessionToken, {
            locale: 'hu-HU',
            appearance: {
              theme: 'minimal',
              fontFamily: 'system',
              variables: {
                colorPrimary: '#18181B',
                colorBackground: '#ffffff',
                colorText: '#18181B',
                borderRadius: '8px',
                borderColor: '#e4e4e7',
                focusRingColor: TEYA.blue
              }
            },
            ...(session.env === 'staging' ? { developmentMode: true } : {})
          })

          if (cancelled) return
          if (!teya) {
            setBootError('Nem sikerült betölteni a biztonságos fizetőfelületet.')
            return
          }

          const checkout = teya.elements.create('checkout', {
            cardOptions: {
              showAcceptedBrands: true,
              iconStyle: 'default'
            },
            submitButtonProps: {
              buttonText: 'Fizetés',
              buttonAmount: amountLabel,
              style: {
                backgroundColor: '#18181B',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: '600'
              }
            },
            onReady: () => {
              if (!cancelled) setReady(true)
            },
            onSuccess: () => {
              if (cancelled) return
              setPaidHint(true)
              toast.success(
                'Fizetés elküldve. A rendelés állapota a bank visszaigazolása után frissül.'
              )
              router.push(partnerHref(`${PARTNER_ORDERS_PATH}/${quoteId}`))
              router.refresh()
            },
            onError: (error: { message?: string }) => {
              if (cancelled) return
              toast.error(
                error?.message?.trim() ||
                  'A fizetés nem sikerült. Próbáld újra a kártyaadatokkal.'
              )
            }
          })

          const el = mountRef.current
          if (!el) {
            setBootError('Nem sikerült megjeleníteni a fizetőfelületet.')
            return
          }
          el.replaceChildren()
          checkout.mount(el)
          checkoutRef.current = checkout
        } catch (err) {
          console.error('PartnerTeyaCheckout SDK', err)
          if (!cancelled) {
            setBootError(
              err instanceof Error
                ? err.message
                : 'Nem sikerült betölteni a biztonságos fizetőfelületet.'
            )
          }
        }
      })()
    })

    return () => {
      cancelled = true
      try {
        checkoutRef.current?.destroy()
      } catch {
        // SDK cleanup best-effort
      }
      checkoutRef.current = null
    }
  }, [quoteId, partnerHref, router])

  const ordersHref = partnerHref(`${PARTNER_ORDERS_PATH}/${quoteId}`)
  const settingsHref = `${partnerHref(PARTNER_SETTINGS_PATH)}?return=${encodeURIComponent(
    partnerHref(`${PARTNER_ORDERS_PATH}/${quoteId}/fizetes`)
  )}#szamlazas`

  const docLabel = orderNumber
    ? `Rendelés ${orderNumber}`
    : `Rendelés ${quoteNumber}`
  const amountLabel = formatQuotePrice(amountHuf)

  const summaryBody = (
    <div className="space-y-3">
      <div>
        <p className="text-label text-ink-secondary">Fizetés ide</p>
        <p className="text-body font-semibold text-ink">{companyLabel}</p>
      </div>

      <div>
        <p className="text-label text-ink-secondary">Dokumentum</p>
        <p className="text-body text-ink">{docLabel}</p>
        {orderNumber && orderNumber !== quoteNumber ? (
          <p className="text-hint text-ink-secondary">Ajánlat {quoteNumber}</p>
        ) : null}
        {projectName ? (
          <p className="text-hint text-ink-secondary">{projectName}</p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-canvas px-3 py-2.5">
        <p className="text-label text-ink-secondary">Fizetendő (bruttó)</p>
        <p className="text-h1 tabular-nums text-ink">{amountLabel}</p>
        {paymentMethodName ? (
          <p className="mt-1 text-hint text-ink-secondary">
            Fizetési mód: {paymentMethodName}
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-label text-ink-secondary">Számlázás</p>
        <p className="text-body text-ink">
          {billingName?.trim() || partnerName}
        </p>
        {billingLine ? (
          <p className="text-hint text-ink-secondary">{billingLine}</p>
        ) : null}
      </div>

      <div className="space-y-1.5 rounded-md border border-border px-3 py-2.5">
        <p className="text-label font-semibold text-ink">Fizetés után</p>
        <ul className="space-y-1 text-hint text-ink-secondary">
          <li>· A bank visszaigazolása után a rendelés „kifizetve” lesz</li>
          <li>· A cég előlegszámlát / számlát állít ki</li>
          <li>· A gyártás / státusz a cég folyamatában folytatódik</li>
        </ul>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={ordersHref}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'gap-1.5 text-ink-secondary'
          )}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Vissza a rendeléshez
        </Link>
        <p className="text-hint text-ink-secondary">
          Fizetés · <span className="text-ink">{companyLabel}</span>
        </p>
      </div>

      <header className="space-y-1">
        <h1 className="text-h1 text-ink">Bankkártyás fizetés</h1>
        <p className="text-body text-ink-secondary">
          Egy lépés: add meg a kártyádat. Az összeget a{' '}
          <span className="font-medium text-ink">{companyLabel}</span> felé
          fizeted — a kártyamezőket a Teya kezeli.
        </p>
      </header>

      {/* Mobile: collapsible summary first */}
      <div className="rounded-lg border border-border bg-surface lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
          aria-expanded={summaryOpen}
          onClick={() => setSummaryOpen((v) => !v)}
        >
          <span>
            <span className="text-label text-ink-secondary">Összegzés</span>
            <span className="mt-0.5 block text-body font-semibold tabular-nums text-ink">
              {amountLabel} · {docLabel}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-secondary transition-transform',
              summaryOpen && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
        {summaryOpen ? (
          <div className="border-t border-border px-3 pb-3 pt-2">{summaryBody}</div>
        ) : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        {/* Payment vault — unique encapsulation (Baymard) */}
        <section className="space-y-3" aria-labelledby={`${mountId}-pay-title`}>
          {bootError ? (
            <div
              className="space-y-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-3"
              role="alert"
            >
              <p className="text-body text-danger-ink">{bootError}</p>
              <div className="flex flex-wrap gap-2">
                {billingLink ? (
                  <Link
                    href={settingsHref}
                    className={buttonVariants({ variant: 'primary', size: 'sm' })}
                  >
                    Számlázási adatok kitöltése
                  </Link>
                ) : null}
                <Link
                  href={ordersHref}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  Vissza a rendeléshez
                </Link>
              </div>
            </div>
          ) : null}

          {paidHint && !bootError ? (
            <p className="text-body text-success-ink" role="status">
              Fizetés elküldve. A rendelés állapota hamarosan frissül.
            </p>
          ) : null}

          <div
            className={cn(
              'overflow-hidden rounded-lg border-2 border-ink/15 bg-[#fafafa] shadow-sm',
              bootError && 'hidden'
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-2.5">
              <div className="space-y-0.5">
                <p
                  id={`${mountId}-pay-title`}
                  className="text-label font-semibold text-ink"
                >
                  Kártyaadatok
                </p>
                <p className="inline-flex items-center gap-1.5 text-hint text-ink-secondary">
                  <Lock className="size-3.5 shrink-0" aria-hidden />
                  Biztonságos mezők · Teya
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold tracking-tight"
                style={{ backgroundColor: TEYA.lime, color: TEYA.charcoal }}
              >
                teya
              </span>
            </div>

            <div className="space-y-2 p-3">
              <div
                ref={mountRef}
                id="partner-teya-checkout"
                className="min-h-[260px] rounded-md bg-white p-1"
                aria-busy={pending && !ready}
                aria-label="Teya bankkártyás fizetés"
              />
              {!bootError && pending && !ready ? (
                <p className="text-hint text-ink-secondary">
                  Fizetőfelület betöltése…
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-hint text-ink-secondary">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  3D Secure
                </span>
                <span>Visa · Mastercard</span>
                <span>A Turinova nem látja a kártyaszámot</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface px-3 py-1">
            <FactRow title="Hol vannak a kártyaadatok?">
              A számot, lejáratot és CVC-t a <strong className="font-medium text-ink">Teya</strong>{' '}
              biztonságos felülete kezeli. A Turinova és a{' '}
              {companyLabel} nem tárolja a teljes kártyaszámot.
            </FactRow>
            <FactRow title="Mikor lesz „kifizetve” a rendelés?">
              A böngésző „sikeres” jelzése után a bank visszaigazolása állítja be
              a végleges státuszt. Ez általában gyors; ha nem frissül, nézd újra a
              rendelést pár perc múlva.
            </FactRow>
            <FactRow title="Segítség kell?">
              Hibás összeg vagy kérdés esetén lépj vissza a rendeléshez, vagy
              keresd a céget (
              <span className="text-ink">{companyLabel}</span>
              ). Számlázási adataidat a{' '}
              <Link href={settingsHref} className="font-medium text-ink underline-offset-2 hover:underline">
                Beállítások → Számlázás
              </Link>{' '}
              alatt módosíthatod.
            </FactRow>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Link
              href={ordersHref}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Mégse / vissza
            </Link>
            <p className="text-hint text-ink-secondary">
              Fizetéskezelő:{' '}
              <a
                href="https://www.teya.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                Teya
              </a>
            </p>
          </div>
        </section>

        {/* Desktop sticky summary */}
        <aside className="hidden lg:block">
          <div className="sticky top-14 space-y-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
            <h2 className="text-h3 text-ink">Összegzés</h2>
            {summaryBody}
          </div>
        </aside>
      </div>
    </div>
  )
}
