'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { looksLikeBarcode } from '@/lib/pos/barcode'
import {
  assignPosBarcodeAction,
  createPosQuickProductAction,
  generatePosInternalBarcodeAction,
  loadPosMissCreateDefaultsAction,
  searchPosAssignProductsAction,
  type PosAssignSearchHit,
  type PosMissTaxOption,
  type PosMissUnitOption
} from '@/lib/pos/miss-product-actions'
import { usePosTouchMode } from '@/lib/pos/touch-mode'
import {
  parseOptionalPurchaseMargin,
  sellGrossFromPurchase
} from '@/lib/pricing/margin'
import { formatMoneyFt } from '@/lib/sales/parse'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { cn } from '@/lib/utils'

export type PosMissProductContext = {
  /** Scan / gépelés nyers szövege */
  query: string
  /** Exact barcode miss esetén a normalizált kód */
  barcode: string | null
  reason: 'barcode' | 'search'
  /** Topbar „Új termék”: egyből a felvétel űrlap */
  startAt?: 'choice' | 'create'
}

type Step = 'choice' | 'create' | 'assign'

type Props = {
  open: boolean
  context: PosMissProductContext | null
  warehouseId: string
  onOpenChange: (open: boolean) => void
  onAdded: (
    product: SaleProductSearchItem,
    source: 'barcode' | 'typeahead'
  ) => void
}

export function PosMissProductDialog({
  open,
  context,
  warehouseId,
  onOpenChange,
  onAdded
}: Props) {
  const { touch } = usePosTouchMode()
  const nameId = useId()
  const barcodeId = useId()
  const unitId = useId()
  const taxId = useId()
  const purchaseId = useId()
  const marginId = useId()
  const priceId = useId()
  const assignQId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const purchaseRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('choice')
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [unitIdValue, setUnitIdValue] = useState('')
  const [taxRateId, setTaxRateId] = useState('')
  const [purchaseRaw, setPurchaseRaw] = useState('')
  const [marginRaw, setMarginRaw] = useState('')
  const [grossRaw, setGrossRaw] = useState('')
  const [taxRates, setTaxRates] = useState<PosMissTaxOption[]>([])
  const [units, setUnits] = useState<PosMissUnitOption[]>([])
  const [defaultsError, setDefaultsError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [assignQ, setAssignQ] = useState('')
  const [assignHits, setAssignHits] = useState<PosAssignSearchHit[]>([])
  const [assignSearching, setAssignSearching] = useState(false)
  const [generatingBarcode, setGeneratingBarcode] = useState(false)
  const assignTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scannedBarcode = context?.barcode?.trim() || null
  const query = context?.query?.trim() || ''
  const fromBarcode = context?.reason === 'barcode' || Boolean(scannedBarcode)

  const selectedTax = taxRates.find((t) => t.id === taxRateId)
  const vatPercent = selectedTax?.rate_percent ?? 0
  const selectedUnit = units.find((u) => u.id === unitIdValue)
  const unitShort = selectedUnit?.shortform ?? 'db'

  useEffect(() => {
    if (!open || !context) return
    const initialStep = context.startAt === 'create' ? 'create' : 'choice'
    setStep(initialStep)
    setError(null)
    setDefaultsError(null)
    setFieldErrors({})
    setPurchaseRaw('')
    setMarginRaw('')
    setGrossRaw('')
    setAssignQ('')
    setAssignHits([])
    setTaxRates([])
    setUnits([])
    setTaxRateId('')
    setUnitIdValue('')

    const code = context.barcode?.trim() || ''
    const q = context.query.trim()
    setBarcode(code)
    if (code && looksLikeBarcode(q)) {
      setName('')
    } else if (q && !looksLikeBarcode(q)) {
      setName(q.slice(0, 200))
    } else {
      setName('')
    }

    window.setTimeout(() => {
      if (initialStep === 'choice') cancelRef.current?.focus()
    }, 40)
  }, [open, context])

  useEffect(() => {
    if (!open || step !== 'create') return
    let cancelled = false
    setDefaultsError(null)
    void loadPosMissCreateDefaultsAction().then((r) => {
      if (cancelled) return
      if (!r.ok) {
        setDefaultsError(r.message)
        return
      }
      setTaxRates(r.taxRates)
      setTaxRateId(r.defaultTaxRateId)
      setUnits(r.units)
      setUnitIdValue(r.defaultUnitId)
      window.setTimeout(() => nameRef.current?.focus(), 40)
    })
    return () => {
      cancelled = true
    }
  }, [open, step])

  useEffect(() => {
    if (!open || step !== 'assign') return
    if (assignTimer.current) clearTimeout(assignTimer.current)
    const q = assignQ.trim()
    if (q.length < 2) {
      setAssignHits([])
      setAssignSearching(false)
      return
    }
    setAssignSearching(true)
    assignTimer.current = setTimeout(() => {
      void searchPosAssignProductsAction(q).then((r) => {
        setAssignSearching(false)
        if (!r.ok) {
          setError(r.message)
          setAssignHits([])
          return
        }
        setError(null)
        setAssignHits(r.rows)
      })
    }, 220)
    return () => {
      if (assignTimer.current) clearTimeout(assignTimer.current)
    }
  }, [assignQ, open, step])

  function close() {
    onOpenChange(false)
  }

  function generateBarcode() {
    setError(null)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.barcode
      return next
    })
    setGeneratingBarcode(true)
    void generatePosInternalBarcodeAction().then((r) => {
      setGeneratingBarcode(false)
      if (!r.ok) {
        setError(r.message)
        return
      }
      setBarcode(r.barcode)
    })
  }

  function applySellFromPurchase() {
    const parsed = parseOptionalPurchaseMargin(purchaseRaw, marginRaw)
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors)
      setError('Ellenőrizd a beszerzési árat / árrés szorzót.')
      return
    }
    if (parsed.purchasePriceNet == null || parsed.marginFactor == null) {
      setError('Add meg a beszerzési nettót és a szorzót.')
      return
    }
    setGrossRaw(
      String(
        sellGrossFromPurchase(
          parsed.purchasePriceNet,
          parsed.marginFactor,
          vatPercent
        )
      )
    )
    setError(null)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next.purchasePriceNet
      delete next.marginFactor
      delete next.unitPriceGross
      return next
    })
  }

  function submitCreate() {
    setError(null)
    setFieldErrors({})

    const purchaseParsed = parseOptionalPurchaseMargin(purchaseRaw, marginRaw)
    if (!purchaseParsed.ok) {
      setFieldErrors(purchaseParsed.fieldErrors)
      setError('Ellenőrizd a beszerzési árat / árrés szorzót.')
      return
    }

    const grossTrim = grossRaw.trim()
    const gross = grossTrim
      ? Math.round(Number(grossTrim.replace(/\s/g, '').replace(',', '.')))
      : null
    if (grossTrim && (gross == null || !Number.isFinite(gross))) {
      setFieldErrors({ unitPriceGross: 'Érvénytelen bruttó ár.' })
      setError('Érvénytelen bruttó ár.')
      return
    }

    startTransition(async () => {
      const r = await createPosQuickProductAction({
        name,
        unitPriceGross: gross,
        barcode: barcode.trim() || null,
        taxRateId: taxRateId || null,
        unitId: unitIdValue || null,
        purchasePriceNet: purchaseParsed.purchasePriceNet,
        marginFactor: purchaseParsed.marginFactor,
        warehouseId
      })
      if (!r.ok) {
        setError(r.message)
        setFieldErrors(r.fieldErrors ?? {})
        return
      }
      onAdded(r.product, fromBarcode ? 'barcode' : 'typeahead')
      close()
    })
  }

  function submitAssign(hit: PosAssignSearchHit) {
    const code = barcode.trim() || scannedBarcode
    if (!code) {
      setError(
        'Nincs vonalkód a hozzárendeléshez — használd a gyors felvételt.'
      )
      return
    }
    setError(null)
    startTransition(async () => {
      const r = await assignPosBarcodeAction({
        accessoryId: hit.id,
        barcode: code,
        warehouseId
      })
      if (!r.ok) {
        setError(r.message)
        return
      }
      onAdded(r.product, 'barcode')
      close()
    })
  }

  if (!context) return null

  const title =
    step === 'create'
      ? 'Új termék'
      : step === 'assign'
        ? 'Hozzárendelés meglévőhöz'
        : fromBarcode
          ? 'Ismeretlen vonalkód'
          : query
            ? 'Nincs találat'
            : 'Új termék'

  const description =
    step === 'choice'
      ? fromBarcode
        ? 'Ez a kód nincs a pultkatalógusban — ellenőrizd a beolvasott értéket (HU billentyűzet: ö/ü/Y).'
        : query
          ? `Nincs találat: „${query}”.`
          : 'Válaszd a felvételt vagy a meglévő termékhez rendelést.'
      : step === 'create'
        ? 'Kitöltés után azonnal a kosárba kerül.'
        : 'A nagy katalógusból is választhatsz (nem csak POS-eladható).'

  /** Minden control azonos magasság (Input / MenuSelect / gomb). */
  const ctrlH = touch ? 'h-12' : 'h-8'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto sm:max-w-md',
          touch && 'sm:max-w-lg'
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'choice' && fromBarcode && (scannedBarcode || query) ? (
          <div
            className="rounded-md border border-border bg-subtle/60 px-3 py-2"
            role="status"
          >
            <p className="text-hint text-ink-secondary">Beolvasva</p>
            <p className="mt-0.5 break-all font-mono text-body font-semibold tabular-nums text-ink">
              {scannedBarcode || query}
            </p>
            {scannedBarcode &&
            query &&
            scannedBarcode !== query &&
            scannedBarcode.toUpperCase() !== query.toUpperCase() ? (
              <p className="mt-1 break-all font-mono text-hint text-ink-muted">
                nyers: {query}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-hint text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}

        {step === 'choice' ? (
          <div className="flex flex-col gap-2">
            {(scannedBarcode || barcode) && (
              <p className="rounded-md border border-border bg-subtle px-3 py-2 font-mono text-hint text-ink">
                {scannedBarcode || barcode}
              </p>
            )}
            <Button
              type="button"
              className={ctrlH}
              disabled={pending}
              onClick={() => setStep('create')}
            >
              Új termék felvétele
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={ctrlH}
              disabled={
                pending ||
                !(scannedBarcode || barcode || looksLikeBarcode(query))
              }
              onClick={() => {
                if (!barcode && looksLikeBarcode(query))
                  setBarcode(query.trim())
                setStep('assign')
              }}
            >
              Hozzárendelem meglévőhöz
            </Button>
            {!fromBarcode && !looksLikeBarcode(query) ? (
              <p className="text-hint text-ink-muted">
                Hozzárendeléshez scannelj vagy írj be vonalkódot a gyors
                felvételnél.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'create' ? (
          <div className="flex flex-col gap-3">
            {defaultsError ? (
              <p className="text-hint text-danger-ink" role="alert">
                {defaultsError}
              </p>
            ) : null}

            {/* 1. Mi ez? */}
            <FormField
              label="Név"
              htmlFor={nameId}
              required
              error={fieldErrors.name}
            >
              <Input
                ref={nameRef}
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                className={ctrlH}
                disabled={pending}
              />
            </FormField>

            {/* 2. Scan / címke */}
            <FormField
              label="Vonalkód"
              htmlFor={barcodeId}
              optionalLabel={!fromBarcode}
              error={fieldErrors.barcode}
            >
              <div className="flex gap-2">
                <Input
                  id={barcodeId}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  autoComplete="off"
                  className={cn('min-w-0 flex-1 font-mono', ctrlH)}
                  disabled={pending || generatingBarcode}
                  readOnly={Boolean(scannedBarcode) && fromBarcode}
                />
                {!(scannedBarcode && fromBarcode) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className={cn('w-[7.5rem] shrink-0 px-2', ctrlH)}
                    disabled={pending || generatingBarcode}
                    onClick={generateBarcode}
                  >
                    {generatingBarcode ? '…' : 'Generálás'}
                  </Button>
                ) : null}
              </div>
            </FormField>

            {/* 3. ÁFA (egység default db — csak ha több van) */}
            <div
              className={cn(
                'grid gap-3',
                units.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
              )}
            >
              {units.length > 1 ? (
                <FormField
                  label="Egység"
                  htmlFor={unitId}
                  required
                  error={fieldErrors.unitId}
                >
                  <MenuSelect
                    id={unitId}
                    value={unitIdValue}
                    onChange={setUnitIdValue}
                    disabled={pending || units.length === 0}
                    allowEmpty={false}
                    portal={false}
                    triggerClassName={ctrlH}
                    options={units.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.shortform})`
                    }))}
                    placeholder="Válassz…"
                  />
                </FormField>
              ) : null}

              <FormField
                label="ÁFA"
                htmlFor={taxId}
                required
                error={fieldErrors.taxRateId}
              >
                <MenuSelect
                  id={taxId}
                  value={taxRateId}
                  onChange={setTaxRateId}
                  disabled={pending || taxRates.length === 0}
                  allowEmpty={false}
                  portal={false}
                  triggerClassName={ctrlH}
                  options={taxRates.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.rate_percent} %)`
                  }))}
                  placeholder="Válassz…"
                />
              </FormField>
            </div>

            {/* 4. Árazás */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Beszerzési nettó"
                htmlFor={purchaseId}
                optionalLabel
                error={fieldErrors.purchasePriceNet}
              >
                <div className="relative">
                  <Input
                    ref={purchaseRef}
                    id={purchaseId}
                    value={purchaseRaw}
                    onChange={(e) => setPurchaseRaw(e.target.value)}
                    inputMode="numeric"
                    className={cn('pr-9', ctrlH)}
                    disabled={pending}
                    autoComplete="off"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                    Ft
                  </span>
                </div>
              </FormField>

              <FormField
                label="Árrés szorzó"
                htmlFor={marginId}
                optionalLabel
                error={fieldErrors.marginFactor}
              >
                <Input
                  id={marginId}
                  value={marginRaw}
                  onChange={(e) => setMarginRaw(e.target.value)}
                  inputMode="decimal"
                  className={ctrlH}
                  disabled={pending}
                  autoComplete="off"
                />
              </FormField>
            </div>

            <Button
              type="button"
              variant="secondary"
              className={cn('w-full', ctrlH)}
              disabled={pending}
              onClick={applySellFromPurchase}
            >
              Eladási ár számítása
            </Button>

            <FormField
              label="Bruttó eladási ár"
              htmlFor={priceId}
              required
              error={fieldErrors.unitPriceGross}
              hint={`Polcár · Ft / ${unitShort}${vatPercent ? ` · ${vatPercent} % ÁFA` : ''} — pontosan ez megy a kosárba.`}
            >
              <div className="relative">
                <Input
                  id={priceId}
                  inputMode="numeric"
                  value={grossRaw}
                  onChange={(e) => setGrossRaw(e.target.value)}
                  autoComplete="off"
                  className={cn('pr-9', ctrlH)}
                  disabled={pending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      submitCreate()
                    }
                  }}
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hint text-ink-muted">
                  Ft
                </span>
              </div>
            </FormField>
          </div>
        ) : null}

        {step === 'assign' ? (
          <div className="flex flex-col gap-3">
            <p className="rounded-md border border-border bg-subtle px-3 py-2 font-mono text-hint text-ink">
              {barcode.trim() || scannedBarcode || '—'}
            </p>
            <FormField label="Meglévő termék keresése" htmlFor={assignQId}>
              <Input
                id={assignQId}
                value={assignQ}
                onChange={(e) => setAssignQ(e.target.value)}
                autoComplete="off"
                autoFocus
                className={ctrlH}
                disabled={pending}
                placeholder="Név, SKU…"
              />
            </FormField>
            <div className="max-h-56 overflow-auto rounded-md border border-border">
              {assignSearching ? (
                <p className="p-3 text-hint text-ink-secondary">Keresés…</p>
              ) : assignQ.trim().length < 2 ? (
                <p className="p-3 text-hint text-ink-muted">
                  Írj legalább 2 karaktert.
                </p>
              ) : assignHits.length === 0 ? (
                <p className="p-3 text-hint text-ink-secondary">Nincs találat.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {assignHits.map((hit) => {
                    const gross = Math.round(
                      hit.price_net * (1 + hit.tax_rate_percent / 100)
                    )
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          disabled={pending}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-subtle',
                            touch && 'py-3'
                          )}
                          onClick={() => submitAssign(hit)}
                        >
                          <span className="text-body text-ink line-clamp-2">
                            {hit.name}
                          </span>
                          <span className="text-hint text-ink-secondary">
                            {hit.sku}
                            {hit.barcode ? ` · ${hit.barcode}` : ''}
                            {!hit.sellable_pos ? ' · még nem POS' : ''}
                            {' · '}
                            {formatMoneyFt(gross)} Ft
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 'choice' ? (
            <Button
              ref={cancelRef}
              type="button"
              variant="secondary"
              className={ctrlH}
              disabled={pending}
              onClick={close}
            >
              Mégse
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                className={ctrlH}
                disabled={pending}
                onClick={() => {
                  setError(null)
                  setFieldErrors({})
                  if (context.startAt === 'create' && step === 'create') {
                    close()
                    return
                  }
                  setStep('choice')
                }}
              >
                {context.startAt === 'create' && step === 'create'
                  ? 'Mégse'
                  : 'Vissza'}
              </Button>
              {step === 'create' ? (
                <Button
                  type="button"
                  className={ctrlH}
                  disabled={pending || Boolean(defaultsError)}
                  onClick={submitCreate}
                >
                  {pending ? 'Mentés…' : 'Mentés és kosárba'}
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
