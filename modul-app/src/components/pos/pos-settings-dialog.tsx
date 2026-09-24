'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  loadPosSettingsAction,
  savePosSettingsAction,
  testPosTeyaConnectionAction
} from '@/lib/pos/settings-actions'
import {
  loadPosQuickItemsAdminAction,
  savePosQuickItemsAction
} from '@/lib/pos/quick-items-actions'
import {
  POS_LABEL_MAX,
  POS_QUICK_ITEMS_MAX,
  resolvePosDisplayName
} from '@/lib/pos/quick-items'
import type { PosQuickItemAdmin } from '@/lib/pos/quick-items'
import { searchSaleProductsAction } from '@/lib/sales/actions'
import type {
  PosCardProvider,
  PosPayModeSetting,
  PosStockPolicy,
  TenantPosSettings,
  TeyaEnv
} from '@/lib/pos/settings-types'
import type { PosRegister } from '@/lib/pos/shifts'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { PosQuickTile } from '@/components/pos/pos-quick-tile'

type SectionId = 'pay' | 'sale' | 'card' | 'quick'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
  registerId: string | null
  registers: PosRegister[]
  /** Megnyitáskor ezt a szekciót mutatja (pl. gyors termék empty CTA). */
  initialSection?: SectionId
}

const SECTIONS: Array<{ id: SectionId; label: string; hint: string }> = [
  {
    id: 'pay',
    label: 'Fizetés',
    hint: 'Hogyan fizethetnek?'
  },
  {
    id: 'sale',
    label: 'Eladás',
    hint: 'Mit engedünk a pulton?'
  },
  {
    id: 'quick',
    label: 'Gyors termékek',
    hint: '1 tap a pulton'
  },
  {
    id: 'card',
    label: 'Kártyagép',
    hint: 'Melyik gép kapja az összeget?'
  }
]

const PROVIDER_OPTIONS: Array<{
  value: PosCardProvider
  title: string
  hint: string
}> = [
  {
    value: 'teya',
    title: 'Teya terminál',
    hint: 'Az összeg automatikusan a kártyagépre megy.'
  },
  {
    value: 'manual',
    title: 'Más / kézi terminál',
    hint: 'Te indítod a gépen, itt csak megerősíted.'
  },
  {
    value: 'none',
    title: 'Nincs kártyagép',
    hint: 'Kártyánál nincs gépi indítás.'
  }
]

export function PosSettingsDialog({
  open,
  onOpenChange,
  onSaved,
  registerId,
  registers,
  initialSection
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [section, setSection] = useState<SectionId>('pay')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canWrite, setCanWrite] = useState(true)

  const [provider, setProvider] = useState<PosCardProvider>('manual')
  const [teyaEnv, setTeyaEnv] = useState<TeyaEnv>('production')
  const [storeId, setStoreId] = useState('')
  const [terminalId, setTerminalId] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [eposId, setEposId] = useState('modul-pos')
  const [hasStoredSecret, setHasStoredSecret] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [allowCash, setAllowCash] = useState(true)
  const [allowCard, setAllowCard] = useState(true)
  const [allowSplit, setAllowSplit] = useState(true)
  const [defaultPayMode, setDefaultPayMode] =
    useState<PosPayModeSetting | ''>('')
  const [stockPolicy, setStockPolicy] = useState<PosStockPolicy>('warn')
  const [maxDiscount, setMaxDiscount] = useState(100)
  const [showInvoice, setShowInvoice] = useState(true)
  const [requireCustomer, setRequireCustomer] = useState(false)

  const [regTerminalId, setRegTerminalId] = useState('')
  const [regEposId, setRegEposId] = useState('')

  const [quickItems, setQuickItems] = useState<PosQuickItemAdmin[]>([])
  const [quickLoading, setQuickLoading] = useState(false)
  const [quickAddQ, setQuickAddQ] = useState('')
  const [quickHits, setQuickHits] = useState<
    Array<{ id: string; name: string; sku: string }>
  >([])
  const [quickSearching, setQuickSearching] = useState(false)

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const quickSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeRegister = registers.find((r) => r.id === registerId) ?? null

  function applySettings(s: TenantPosSettings) {
    setProvider(s.card_provider)
    setTeyaEnv(s.teya_env)
    setStoreId(s.teya_store_id ?? '')
    setTerminalId(s.teya_terminal_id ?? '')
    setClientId(s.teya_client_id ?? '')
    setClientSecret('')
    setEposId(s.teya_epos_instance_id || 'modul-pos')
    setHasStoredSecret(Boolean(s.teya_client_secret?.trim()))
    setAllowCash(s.allow_cash !== false)
    setAllowCard(s.allow_card !== false)
    setAllowSplit(s.allow_split !== false)
    setDefaultPayMode(s.default_pay_mode ?? '')
    setStockPolicy(s.stock_policy === 'block' ? 'block' : 'warn')
    setMaxDiscount(s.max_discount_percent ?? 100)
    setShowInvoice(s.show_invoice_button !== false)
    setRequireCustomer(Boolean(s.require_customer))
  }

  useEffect(() => {
    if (!open) return
    setSection(initialSection ?? 'pay')
    setMessage(null)
    setError(null)
    setLoadError(null)
    setAdvancedOpen(false)
    setQuickAddQ('')
    setQuickHits([])
    setLoading(true)
    let cancelled = false
    void loadPosSettingsAction().then((r) => {
      if (cancelled) return
      setLoading(false)
      if (!r.ok) {
        setLoadError(r.message)
        return
      }
      setCanWrite(r.canWrite)
      applySettings(r.settings)
      window.setTimeout(() => cancelRef.current?.focus(), 0)
    })
    return () => {
      cancelled = true
    }
  }, [open, initialSection])

  useEffect(() => {
    if (!open) return
    const reg = registers.find((r) => r.id === registerId)
    setRegTerminalId(reg?.teya_terminal_id ?? '')
    setRegEposId(reg?.teya_epos_instance_id ?? '')
  }, [open, registerId, registers])

  useEffect(() => {
    if (!open || section !== 'quick') return
    setQuickLoading(true)
    let cancelled = false
    void loadPosQuickItemsAdminAction().then((r) => {
      if (cancelled) return
      setQuickLoading(false)
      if (!r.ok) {
        setError(r.message)
        return
      }
      setQuickItems(r.items)
    })
    return () => {
      cancelled = true
    }
  }, [open, section])

  useEffect(() => {
    if (!open || section !== 'quick') return
    if (quickSearchTimer.current) clearTimeout(quickSearchTimer.current)
    const q = quickAddQ.trim()
    if (q.length < 1) {
      setQuickHits([])
      setQuickSearching(false)
      return
    }
    setQuickSearching(true)
    quickSearchTimer.current = setTimeout(() => {
      // warehouseId nem kell a settings addhoz — keressünk stock nélkül (üres wh → 0 találat).
      // A searchSaleProductsAction warehouse-kötött; használjunk egy „dummy” nélkül:
      // helyette a sales search csak wh-val megy. Settingsben a registers[0].warehouse_id.
      const wh =
        registers.find((r) => r.id === registerId)?.warehouse_id ??
        registers[0]?.warehouse_id ??
        ''
      if (!wh) {
        setQuickSearching(false)
        setQuickHits([])
        return
      }
      void searchSaleProductsAction(q, wh, {
        inStockOnly: false,
        stockFirst: false,
        limit: 8
      }).then((res) => {
        setQuickSearching(false)
        if (!res.ok) {
          setQuickHits([])
          return
        }
        const taken = new Set(quickItems.map((i) => i.accessory_id))
        setQuickHits(
          res.rows
            .filter((row) => !taken.has(row.id))
            .map((row) => ({ id: row.id, name: row.name, sku: row.sku }))
        )
      })
    }, 180)
    return () => {
      if (quickSearchTimer.current) clearTimeout(quickSearchTimer.current)
    }
  }, [open, section, quickAddQ, registerId, registers, quickItems])

  // Ha a default mód már nem engedélyezett, ürítsük.
  useEffect(() => {
    if (defaultPayMode === 'cash' && !allowCash) setDefaultPayMode('')
    if (defaultPayMode === 'card' && !allowCard) setDefaultPayMode('')
    if (defaultPayMode === 'split' && (!allowSplit || !allowCash || !allowCard)) {
      setDefaultPayMode('')
    }
    if (allowSplit && (!allowCash || !allowCard)) setAllowSplit(false)
  }, [allowCash, allowCard, allowSplit, defaultPayMode])

  const hasSecret = hasStoredSecret || Boolean(clientSecret.trim())

  const status = useMemo(() => {
    const tenders: string[] = []
    if (allowCash) tenders.push('Készpénz')
    if (allowCard) tenders.push('Kártya')
    if (allowSplit && allowCash && allowCard) tenders.push('Vegyes')

    if (provider === 'teya') {
      const ready =
        Boolean(storeId.trim()) &&
        Boolean(terminalId.trim()) &&
        Boolean(clientId.trim()) &&
        hasSecret
      return ready
        ? {
            tone: 'success' as const,
            label: tenders.length ? `${tenders[0]} · Teya kész` : 'Teya kész'
          }
        : { tone: 'warning' as const, label: 'Teya hiányos' }
    }
    if (provider === 'manual') {
      return {
        tone: 'neutral' as const,
        label: tenders.length ? `${tenders.join(' + ')} · kézi gép` : 'Kézi gép'
      }
    }
    return {
      tone: 'neutral' as const,
      label: tenders.length ? tenders.join(' + ') : 'Nincs fizetés'
    }
  }, [
    provider,
    storeId,
    terminalId,
    clientId,
    hasSecret,
    allowCash,
    allowCard,
    allowSplit
  ])

  const defaultPayOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: '', label: 'Nincs — a kezelő választ' }
    ]
    if (allowCash) opts.push({ value: 'cash', label: 'Készpénz' })
    if (allowCard) opts.push({ value: 'card', label: 'Kártya' })
    if (allowSplit && allowCash && allowCard) {
      opts.push({ value: 'split', label: 'Vegyes (KP + kártya)' })
    }
    return opts
  }, [allowCash, allowCard, allowSplit])

  const stockOptions = [
    {
      value: 'warn',
      label: 'Figyelmeztet (eladható)',
      hint: 'Sárga jelzés, de mehet'
    },
    {
      value: 'block',
      label: 'Nem engedi az eladást',
      hint: 'Előbb csökkentsd a mennyiséget'
    }
  ]

  const envOptions = [
    { value: 'production', label: 'Éles' },
    { value: 'staging', label: 'Teszt' }
  ]

  function persistQuick(next: PosQuickItemAdmin[], okMsg?: string) {
    setQuickItems(next)
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const r = await savePosQuickItemsAction(
        next.map((i) => ({
          accessoryId: i.accessory_id,
          posLabel: i.pos_label
        }))
      )
      if (!r.ok) {
        setError(r.message)
        void loadPosQuickItemsAdminAction().then((reload) => {
          if (reload.ok) setQuickItems(reload.items)
        })
        return
      }
      setMessage(okMsg ?? 'Gyors termékek mentve.')
      onSaved?.()
    })
  }

  function addQuick(hit: { id: string; name: string; sku: string }) {
    if (quickItems.length >= POS_QUICK_ITEMS_MAX) {
      setError(`Legfeljebb ${POS_QUICK_ITEMS_MAX} gyors termék lehet.`)
      return
    }
    if (quickItems.some((i) => i.accessory_id === hit.id)) return
    const display = resolvePosDisplayName(hit.name, null)
    const row: PosQuickItemAdmin = {
      id: `tmp-${hit.id}`,
      accessory_id: hit.id,
      sort_order: quickItems.length,
      pos_label: null,
      name: hit.name,
      sku: hit.sku,
      active: true,
      sellable_pos: true,
      image_url: null,
      display_name: display
    }
    setQuickAddQ('')
    setQuickHits([])
    persistQuick([...quickItems, row], 'Hozzáadva a gyorsrácshoz.')
  }

  function updateQuickLabel(accessoryId: string, raw: string) {
    const next = quickItems.map((i) => {
      if (i.accessory_id !== accessoryId) return i
      const pos_label = raw.trim() ? raw.slice(0, POS_LABEL_MAX) : null
      return {
        ...i,
        pos_label,
        display_name: resolvePosDisplayName(i.name, pos_label)
      }
    })
    setQuickItems(next)
  }

  function commitQuickLabels() {
    persistQuick(quickItems, 'Pult feliratok mentve.')
  }

  function moveQuick(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= quickItems.length) return
    const next = [...quickItems]
    const tmp = next[index]!
    next[index] = next[j]!
    next[j] = tmp
    persistQuick(
      next.map((item, i) => ({ ...item, sort_order: i })),
      'Sorrend mentve.'
    )
  }

  function removeQuick(accessoryId: string) {
    persistQuick(
      quickItems.filter((i) => i.accessory_id !== accessoryId),
      'Eltávolítva.'
    )
  }

  function save() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const r = await savePosSettingsAction({
        cardProvider: provider,
        teyaEnv,
        teyaStoreId: storeId,
        teyaTerminalId: terminalId,
        teyaClientId: clientId,
        teyaClientSecret: clientSecret,
        teyaEposInstanceId: eposId,
        allowCash,
        allowCard,
        allowSplit,
        defaultPayMode: defaultPayMode || null,
        stockPolicy,
        maxDiscountPercent: maxDiscount,
        showInvoiceButton: showInvoice,
        requireCustomer,
        registerId,
        registerTeyaTerminalId: regTerminalId,
        registerTeyaEposInstanceId: regEposId
      })
      if (!r.ok) {
        setError(r.message)
        return
      }
      setClientSecret('')
      if (clientSecret.trim()) setHasStoredSecret(true)
      onSaved?.()
      onOpenChange(false)
    })
  }

  const sectionMeta = SECTIONS.find((s) => s.id === section)!

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>POS beállítások</DialogTitle>
            {!loading && !loadError ? (
              <StatusBadge tone={status.tone} variant="outline">
                {status.label}
              </StatusBadge>
            ) : null}
          </div>
          <p className="text-hint text-ink-secondary">
            A pult így fog fizetni és eladni.
          </p>
        </DialogHeader>

        {/* Mobil szekcióchip-ek */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-3 py-2 sm:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSection(s.id)
                setError(null)
                setMessage(null)
              }}
              className={cn(
                'shrink-0 rounded-md border px-2.5 py-1.5 text-body',
                section === s.id
                  ? 'border-ink bg-ink text-surface'
                  : 'border-border bg-surface text-ink hover:bg-subtle'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Desktop bal nav */}
          <nav
            className="hidden w-[11.5rem] shrink-0 flex-col gap-0.5 border-r border-border bg-subtle/40 p-2 sm:flex"
            aria-label="Beállítás szekciók"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSection(s.id)
                  setError(null)
                  setMessage(null)
                }}
                className={cn(
                  'rounded-md px-2.5 py-2 text-left transition-colors',
                  section === s.id
                    ? 'bg-surface font-medium text-ink ring-1 ring-border'
                    : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                )}
              >
                <span className="block text-body">{s.label}</span>
                <span className="mt-0.5 block text-hint text-ink-secondary">
                  {s.hint}
                </span>
              </button>
            ))}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <p className="text-body text-ink-secondary">Betöltés…</p>
            ) : loadError ? (
              <p className="text-body text-danger-ink" role="alert">
                {loadError}
              </p>
            ) : (
              <div className="space-y-3">
                {!canWrite ? (
                  <p className="text-hint text-ink-secondary">
                    Nincs szerkesztési jog — csak megtekintés.
                  </p>
                ) : null}

                <div className="sm:hidden">
                  <h3 className="text-h3 text-ink">{sectionMeta.label}</h3>
                  <p className="text-hint text-ink-secondary">
                    {sectionMeta.hint}
                  </p>
                </div>

                {section === 'pay' ? (
                  <section className="space-y-3" aria-labelledby="pos-sec-pay">
                    <div className="hidden sm:block">
                      <h3 id="pos-sec-pay" className="text-h3 text-ink">
                        Hogyan fizethetnek?
                      </h3>
                      <p className="text-hint text-ink-secondary">
                        Ezek a gombok jelennek meg a pult alján.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                      <label className="flex items-start gap-2.5 text-body text-ink">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          checked={allowCash}
                          disabled={!canWrite || pending}
                          onChange={(e) => setAllowCash(e.target.checked)}
                        />
                        <span>
                          <span className="font-medium">Készpénz</span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            Bankjegy / érme, visszajáróval.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 text-body text-ink">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          checked={allowCard}
                          disabled={!canWrite || pending}
                          onChange={(e) => setAllowCard(e.target.checked)}
                        />
                        <span>
                          <span className="font-medium">Kártya</span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            Bankkártya a terminálon.
                          </span>
                        </span>
                      </label>
                      <label
                        className={cn(
                          'flex items-start gap-2.5 text-body text-ink',
                          (!allowCash || !allowCard) && 'opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          checked={allowSplit}
                          disabled={
                            !canWrite || pending || !allowCash || !allowCard
                          }
                          onChange={(e) => setAllowSplit(e.target.checked)}
                        />
                        <span>
                          <span className="font-medium">
                            Vegyes (készpénz + kártya)
                          </span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            {!allowCash || !allowCard
                              ? 'Előbb kapcsold be a készpénzt és a kártyát is.'
                              : 'Egy eladáson belül mindkettő.'}
                          </span>
                        </span>
                      </label>
                    </div>

                    <FormField
                      label="Alapértelmezett mód"
                      htmlFor="pos-def-pay"
                      hint="Ha beállítod, ez lesz a javasolt gomb — a kezelő még válthat."
                    >
                      <MenuSelect
                        id="pos-def-pay"
                        value={defaultPayMode}
                        options={defaultPayOptions}
                        allowEmpty={false}
                        disabled={!canWrite || pending}
                        onChange={(v) =>
                          setDefaultPayMode(v as PosPayModeSetting | '')
                        }
                      />
                    </FormField>
                  </section>
                ) : null}

                {section === 'sale' ? (
                  <section className="space-y-3" aria-labelledby="pos-sec-sale">
                    <div className="hidden sm:block">
                      <h3 id="pos-sec-sale" className="text-h3 text-ink">
                        Mit engedünk a pulton?
                      </h3>
                      <p className="text-hint text-ink-secondary">
                        Mit tehet az eladó hiba nélkül.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField
                        label="Készlethiány"
                        htmlFor="pos-stock"
                        hint="Ha többet adnál el, mint ami van a raktárban."
                      >
                        <MenuSelect
                          id="pos-stock"
                          value={stockPolicy}
                          options={stockOptions}
                          allowEmpty={false}
                          disabled={!canWrite || pending}
                          onChange={(v) =>
                            setStockPolicy(v as PosStockPolicy)
                          }
                        />
                      </FormField>

                      <FormField
                        label="Legnagyobb kedvezmény (%)"
                        htmlFor="pos-max-disc"
                        hint="0 = nincs kedvezmény a pulton."
                      >
                        <Input
                          id="pos-max-disc"
                          type="number"
                          min={0}
                          max={100}
                          className="h-9"
                          value={maxDiscount}
                          disabled={!canWrite || pending}
                          onChange={(e) =>
                            setMaxDiscount(
                              Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            )
                          }
                        />
                      </FormField>
                    </div>

                    <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                      <label className="flex items-start gap-2.5 text-body text-ink">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          checked={showInvoice}
                          disabled={!canWrite || pending}
                          onChange={(e) => setShowInvoice(e.target.checked)}
                        />
                        <span>
                          <span className="font-medium">Számla gomb</span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            Megjelenik a pult tetején („Számlát kér”).
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 text-body text-ink">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 rounded border-border"
                          checked={requireCustomer}
                          disabled={!canWrite || pending}
                          onChange={(e) =>
                            setRequireCustomer(e.target.checked)
                          }
                        />
                        <span>
                          <span className="font-medium">
                            Ügyfél kötelező
                          </span>
                          <span className="mt-0.5 block text-hint text-ink-secondary">
                            Eladás előtt ki kell választani az ügyfelet.
                          </span>
                        </span>
                      </label>
                    </div>
                  </section>
                ) : null}

                {section === 'card' ? (
                  <section className="space-y-3" aria-labelledby="pos-sec-card">
                    <div className="hidden sm:block">
                      <h3 id="pos-sec-card" className="text-h3 text-ink">
                        Melyik gép kapja az összeget?
                      </h3>
                      <p className="text-hint text-ink-secondary">
                        Kártyás fizetésnél ide megy az összeg.
                      </p>
                    </div>

                    <div
                      className="space-y-1.5"
                      role="radiogroup"
                      aria-label="Kártyagép típusa"
                    >
                      {PROVIDER_OPTIONS.map((opt) => {
                        const selected = provider === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={!canWrite || pending}
                            onClick={() => {
                              setProvider(opt.value)
                              setError(null)
                              setMessage(null)
                            }}
                            className={cn(
                              'flex w-full flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors',
                              selected
                                ? 'border-ink bg-subtle'
                                : 'border-border bg-surface hover:bg-subtle/60',
                              (!canWrite || pending) && 'opacity-60'
                            )}
                          >
                            <span className="text-body font-medium text-ink">
                              {opt.title}
                            </span>
                            <span className="text-hint text-ink-secondary">
                              {opt.hint}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {provider === 'teya' ? (
                      <div className="space-y-3 border-t border-border pt-3">
                        <p className="text-hint text-ink-secondary">
                          Ezeket a Teya fiókodból kapod. Ha nem tudod, kérd a
                          boltvezetőtől / IT-től.
                        </p>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <FormField
                            label="Üzlet azonosító"
                            htmlFor="pos-dlg-store"
                            required
                          >
                            <Input
                              id="pos-dlg-store"
                              autoComplete="off"
                              spellCheck={false}
                              value={storeId}
                              disabled={!canWrite || pending}
                              onChange={(e) => setStoreId(e.target.value)}
                            />
                          </FormField>
                          <FormField
                            label="Alap terminál azonosító"
                            htmlFor="pos-dlg-terminal"
                            required
                            hint="Ha több pult van, lent felülírhatod."
                          >
                            <Input
                              id="pos-dlg-terminal"
                              autoComplete="off"
                              spellCheck={false}
                              value={terminalId}
                              disabled={!canWrite || pending}
                              onChange={(e) => setTerminalId(e.target.value)}
                            />
                          </FormField>
                          <FormField
                            label="Kliens azonosító"
                            htmlFor="pos-dlg-client"
                            required
                          >
                            <Input
                              id="pos-dlg-client"
                              autoComplete="off"
                              spellCheck={false}
                              value={clientId}
                              disabled={!canWrite || pending}
                              onChange={(e) => setClientId(e.target.value)}
                            />
                          </FormField>
                          <FormField
                            label="Titkos kulcs"
                            htmlFor="pos-dlg-secret"
                            required={!hasStoredSecret}
                            optionalLabel={hasStoredSecret}
                            hint={
                              hasStoredSecret
                                ? 'Már van mentett kulcs — hagyd üresen, ha nem cseréled.'
                                : undefined
                            }
                          >
                            <Input
                              id="pos-dlg-secret"
                              type="password"
                              autoComplete="new-password"
                              value={clientSecret}
                              disabled={!canWrite || pending}
                              onChange={(e) =>
                                setClientSecret(e.target.value)
                              }
                              placeholder={
                                hasStoredSecret ? '••••••••' : undefined
                              }
                            />
                          </FormField>
                        </div>

                        {activeRegister ? (
                          <div className="space-y-2 rounded-md border border-border bg-subtle/50 p-3">
                            <p className="text-body font-medium text-ink">
                              Ez a pult:{' '}
                              <span className="font-semibold">
                                {activeRegister.name}
                              </span>
                            </p>
                            <p className="text-hint text-ink-secondary">
                              Ha ennek a pultnak saját kártyagépe van, írd be
                              ide. Üresen az alap terminált használjuk.
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <FormField
                                label="Terminál ennél a pultnál"
                                htmlFor="pos-reg-term"
                                optionalLabel
                              >
                                <Input
                                  id="pos-reg-term"
                                  autoComplete="off"
                                  spellCheck={false}
                                  value={regTerminalId}
                                  disabled={!canWrite || pending}
                                  onChange={(e) =>
                                    setRegTerminalId(e.target.value)
                                  }
                                />
                              </FormField>
                              <FormField
                                label="Pult neve a kártyagépen"
                                htmlFor="pos-reg-epos"
                                optionalLabel
                                hint="Rövid név, pl. pult-1."
                              >
                                <Input
                                  id="pos-reg-epos"
                                  autoComplete="off"
                                  spellCheck={false}
                                  value={regEposId}
                                  disabled={!canWrite || pending}
                                  onChange={(e) =>
                                    setRegEposId(e.target.value)
                                  }
                                  placeholder={activeRegister.code}
                                />
                              </FormField>
                            </div>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="text-hint text-ink-secondary underline-offset-2 hover:underline"
                          onClick={() => setAdvancedOpen((o) => !o)}
                        >
                          {advancedOpen
                            ? 'Haladó elrejtése'
                            : 'Haladó beállítások'}
                        </button>
                        {advancedOpen ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <FormField
                              label="Környezet"
                              htmlFor="pos-dlg-env"
                              hint="Általában Éles."
                            >
                              <MenuSelect
                                id="pos-dlg-env"
                                value={teyaEnv}
                                options={envOptions}
                                allowEmpty={false}
                                disabled={!canWrite || pending}
                                onChange={(v) => setTeyaEnv(v as TeyaEnv)}
                              />
                            </FormField>
                            <FormField
                              label="Alap pultnév a gépen"
                              htmlFor="pos-dlg-epos"
                              optionalLabel
                            >
                              <Input
                                id="pos-dlg-epos"
                                autoComplete="off"
                                spellCheck={false}
                                value={eposId}
                                disabled={!canWrite || pending}
                                onChange={(e) => setEposId(e.target.value)}
                                placeholder="modul-pos"
                              />
                            </FormField>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {section === 'quick' ? (
                  <section className="space-y-3" aria-labelledby="pos-sec-quick">
                    <div className="hidden sm:block">
                      <h3 id="pos-sec-quick" className="text-h3 text-ink">
                        Gyors termékek
                      </h3>
                      <p className="text-hint text-ink-secondary">
                        Üres keresőnél ezek a gombok jelennek meg a pulton. Max{' '}
                        {POS_QUICK_ITEMS_MAX} db — a sorrend izommemória.
                      </p>
                    </div>

                    {quickLoading ? (
                      <p className="text-body text-ink-secondary">Betöltés…</p>
                    ) : (
                      <>
                        {quickItems.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-label font-medium text-ink-secondary">
                              Így néz ki a pulton
                            </p>
                            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-subtle/40 p-2.5 sm:grid-cols-3">
                              {quickItems.map((item) => (
                                <PosQuickTile
                                  key={item.accessory_id}
                                  name={item.display_name}
                                  fullName={item.name}
                                  sku={item.sku}
                                  priceLabel=""
                                  imageUrl={item.image_url}
                                  compact
                                  disabled
                                  className={cn(
                                    'pointer-events-none',
                                    (!item.active || !item.sellable_pos) &&
                                      'opacity-50'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <FormField
                          label="Termék hozzáadása"
                          htmlFor="pos-quick-add"
                          hint={`${quickItems.length} / ${POS_QUICK_ITEMS_MAX}`}
                        >
                          <Input
                            id="pos-quick-add"
                            autoComplete="off"
                            value={quickAddQ}
                            disabled={
                              !canWrite ||
                              pending ||
                              quickItems.length >= POS_QUICK_ITEMS_MAX
                            }
                            onChange={(e) => setQuickAddQ(e.target.value)}
                            placeholder="Név vagy cikkszám…"
                          />
                        </FormField>
                        {quickSearching ? (
                          <p className="text-hint text-ink-secondary">
                            Keresés…
                          </p>
                        ) : null}
                        {quickHits.length > 0 ? (
                          <ul className="max-h-40 overflow-auto rounded-md border border-border">
                            {quickHits.map((hit) => (
                              <li key={hit.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left text-body hover:bg-subtle"
                                  disabled={!canWrite || pending}
                                  onClick={() => addQuick(hit)}
                                >
                                  <span className="min-w-0 truncate">
                                    <span className="font-medium text-ink">
                                      {hit.name}
                                    </span>
                                    <span className="ml-1.5 text-hint text-ink-secondary">
                                      {hit.sku}
                                    </span>
                                  </span>
                                  <Plus
                                    className="size-3.5 shrink-0 text-ink-secondary"
                                    aria-hidden
                                  />
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {quickItems.length === 0 ? (
                          <p className="rounded-md border border-dashed border-border p-3 text-body text-ink-secondary">
                            Még nincs gyors termék. Írd be a név / cikkszámot
                            fent, és add hozzá a leggyakoribb pulti cikkeket.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-label font-medium text-ink-secondary">
                              Sorrend, pult felirat, törlés
                            </p>
                            <ul className="divide-y divide-border rounded-md border border-border">
                              {quickItems.map((item, index) => (
                                <li
                                  key={item.accessory_id}
                                  className="space-y-2 px-2.5 py-2.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 shrink-0 text-center text-hint tabular-nums text-ink-muted">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-body font-medium text-ink">
                                        {item.name}
                                      </div>
                                      <div className="text-hint text-ink-secondary">
                                        {item.sku}
                                        {!item.active
                                          ? ' · Inaktív'
                                          : !item.sellable_pos
                                            ? ' · Nem POS'
                                            : ''}
                                        {item.pos_label
                                          ? ' · Rövid felirat aktív'
                                          : ''}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Feljebb"
                                        disabled={
                                          !canWrite || pending || index === 0
                                        }
                                        onClick={() => moveQuick(index, -1)}
                                      >
                                        <ChevronUp
                                          className="size-3.5"
                                          aria-hidden
                                        />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Lejjebb"
                                        disabled={
                                          !canWrite ||
                                          pending ||
                                          index === quickItems.length - 1
                                        }
                                        onClick={() => moveQuick(index, 1)}
                                      >
                                        <ChevronDown
                                          className="size-3.5"
                                          aria-hidden
                                        />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Eltávolítás"
                                        disabled={!canWrite || pending}
                                        onClick={() =>
                                          removeQuick(item.accessory_id)
                                        }
                                      >
                                        <Trash2
                                          className="size-3.5"
                                          aria-hidden
                                        />
                                      </Button>
                                    </div>
                                  </div>
                                  <FormField
                                    label="Pult felirat"
                                    htmlFor={`pos-label-${item.accessory_id}`}
                                    hint={
                                      item.pos_label
                                        ? `${item.pos_label.length} / ${POS_LABEL_MAX} · a méretet hagyd benne (pl. 50 mm)`
                                        : `Üres = teljes név a pulton (ajánlott). Max ${POS_LABEL_MAX} ha rövidítesz.`
                                    }
                                  >
                                    <Input
                                      id={`pos-label-${item.accessory_id}`}
                                      autoComplete="off"
                                      maxLength={POS_LABEL_MAX}
                                      value={item.pos_label ?? ''}
                                      disabled={!canWrite || pending}
                                      placeholder={item.name}
                                      onChange={(e) =>
                                        updateQuickLabel(
                                          item.accessory_id,
                                          e.target.value
                                        )
                                      }
                                      onBlur={() => commitQuickLabels()}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          ;(e.target as HTMLInputElement).blur()
                                        }
                                      }}
                                    />
                                  </FormField>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                ) : null}

                {error ? (
                  <p className="text-hint text-danger-ink" role="alert">
                    {error}
                  </p>
                ) : null}
                {message ? (
                  <p className="text-hint text-success-ink" role="status">
                    {message}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Mégse
          </Button>
          {section === 'card' &&
          provider === 'teya' &&
          !loadError &&
          !loading ? (
            <Button
              type="button"
              variant="secondary"
              disabled={!canWrite || pending}
              onClick={() => {
                setMessage(null)
                setError(null)
                startTransition(async () => {
                  const r = await testPosTeyaConnectionAction()
                  if (!r.ok) {
                    setError(r.message)
                    return
                  }
                  setMessage(r.message ?? 'A kapcsolat rendben van.')
                })
              }}
            >
              Kapcsolat ellenőrzése
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!canWrite || pending || loading || Boolean(loadError)}
            loading={pending}
            onClick={save}
            className={section === 'quick' ? 'hidden' : undefined}
          >
            Mentés
          </Button>
          {section === 'quick' ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Kész
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
