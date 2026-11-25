'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Copy, ExternalLink, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'

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
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/patterns/form-field'
import {
  getArrivalSmsCandidatesAction,
  getHandoverDueAction,
  getOrderTextAction,
  handoverManualItemsAction,
  markArrivedAction,
  type MoHandoverDue,
  setManualItemsStatusAction,
  splitManualItemAction
} from '@/lib/manual-orders/actions'
import { moFmtDateTime, moFmtQty } from '@/lib/manual-orders/format'
import type { OrderTextBlock } from '@/lib/manual-orders/order-text'
import { buildMailtoHref } from '@/lib/suppliers/order-channels'
import { MO_DEPOSIT_METHOD_LABEL, type MoDepositMethod, type MoSmsCandidate } from '@/lib/manual-orders/types'

// ---------------------------------------------------------------------------
// Megjött + SMS
// ---------------------------------------------------------------------------

export function ArrivalSmsDialog({
  open,
  onOpenChange,
  itemIds,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemIds: string[]
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<MoSmsCandidate[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    void getArrivalSmsCandidatesAction({ itemIds }).then((res) => {
      if (!alive) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setCandidates(res.candidates)
      setChecked(new Set(res.candidates.filter((c) => c.mobile).map((c) => c.orderId)))
    })
    return () => {
      alive = false
    }
  }, [open, itemIds])

  function run(withSms: boolean) {
    startTransition(async () => {
      const res = await markArrivedAction({
        itemIds,
        smsOrderIds: withSms ? [...checked] : []
      })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(res.message ?? 'Megjött.')
      onOpenChange(false)
      onDone()
    })
  }

  const smsCount = checked.size
  const preview = candidates.find((c) => checked.has(c.orderId))?.previewBody

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{itemIds.length} tétel megjött — értesítsük a vevőket?</DialogTitle>
          <DialogDescription>
            A státusz akkor is átáll, ha egy SMS nem megy ki.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-4 text-body text-ink-secondary">Betöltés…</p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-auto rounded-md border border-border">
            {candidates.map((c) => {
              const partial = c.readyCount < c.totalCount
              return (
                <li key={c.orderId} className="flex items-start gap-2.5 px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-3.5 accent-ink"
                    disabled={!c.mobile}
                    checked={checked.has(c.orderId)}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.orderId)) next.delete(c.orderId)
                        else next.add(c.orderId)
                        return next
                      })
                    }
                    aria-label={`SMS: ${c.customerName}`}
                  />
                  <div className="min-w-0 flex-1 text-body">
                    <p className="font-medium text-ink">
                      {c.customerName} <span className="font-normal text-ink-secondary">· {c.orderNumber}</span>
                    </p>
                    <p className="text-hint text-ink-secondary">
                      {c.mobile ?? 'nincs mobilszám — nem küldhető'} · {c.readyCount}/{c.totalCount} tétel
                      {partial ? ' (részleges)' : ''}
                      {c.alreadySentAt ? ` · már ment SMS: ${moFmtDateTime(c.alreadySentAt)}` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {preview ? (
          <p className="rounded-md bg-subtle px-3 py-2 text-hint text-ink-secondary">
            Előnézet: „{preview}”
          </p>
        ) : null}

        <DialogFooter className="flex-wrap gap-1.5">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button type="button" variant="secondary" disabled={pending || loading} onClick={() => run(false)}>
            Csak megjött, SMS nélkül
          </Button>
          <Button type="button" loading={pending} disabled={loading || smsCount === 0} onClick={() => run(true)}>
            Megjött + {smsCount} SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Rendelési szöveg
// ---------------------------------------------------------------------------

/** A levelezők a ~2000 karakternél hosszabb mailto: linket csonkolhatják. */
const MAILTO_MAX = 1900

const CHANNEL_LABEL: Record<NonNullable<OrderTextBlock['preferred']>, string> = {
  email: 'e-mail',
  internet: 'webshop',
  phone: 'telefon',
  in_person: 'személyes'
}

const NO_IDS: string[] = []

export function OrderTextDialog({
  open,
  onOpenChange,
  itemIds,
  reorderIds = NO_IDS,
  markableIds,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemIds: string[]
  /** Már „Megrendelve” tételek: csak külön bekapcsolva kerülnek a szövegbe (dupla rendelés veszély). */
  reorderIds?: string[]
  /** Nyitott tételek: másolás után „Megrendelve” lehet. */
  markableIds: string[]
  onDone: () => void
}) {
  const [blocks, setBlocks] = useState<OrderTextBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [markAfter, setMarkAfter] = useState(true)
  const [includeReorder, setIncludeReorder] = useState(false)
  const [pending, startTransition] = useTransition()
  const reorderOnly = itemIds.length === 0
  const withReorder = includeReorder || reorderOnly
  const textIds = useMemo(
    () => (withReorder ? [...itemIds, ...reorderIds] : itemIds),
    [withReorder, itemIds, reorderIds]
  )

  useEffect(() => {
    if (!open) return
    if (textIds.length === 0) {
      setBlocks([])
      return
    }
    let alive = true
    setLoading(true)
    void getOrderTextAction({ itemIds: textIds }).then((res) => {
      if (!alive) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      setBlocks(res.blocks)
    })
    return () => {
      alive = false
    }
  }, [open, textIds])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Szöveg a vágólapon.')
    } catch {
      toast.error('Nem sikerült másolni — jelöld ki és másold kézzel.')
    }
  }

  function finish() {
    if (!markAfter || markableIds.length === 0) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      const res = await setManualItemsStatusAction({ itemIds: markableIds, status: 'megrendelve' })
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      toast.success(`${res.changed ?? 0} tétel: Megrendelve.`)
      onOpenChange(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Rendelési szöveg</DialogTitle>
          <DialogDescription>Beszállítónként külön, a beszállító e-mail bevezetőjével — küldés előtt szerkeszthető.</DialogDescription>
        </DialogHeader>
        {reorderIds.length > 0 ? (
          <div className="space-y-1">
            {!reorderOnly ? (
              <label className="flex items-center gap-2 text-body text-ink">
                <input
                  type="checkbox"
                  className="size-3.5 accent-ink"
                  checked={includeReorder}
                  onChange={(e) => setIncludeReorder(e.target.checked)}
                />
                Megrendelt tételek újraküldése ({reorderIds.length})
              </label>
            ) : null}
            {withReorder ? (
              <p className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-hint text-warning-ink">
                {reorderIds.length} tétel már „Megrendelve” — csak akkor küldd újra, ha a beszállító nem kapta meg.
              </p>
            ) : null}
          </div>
        ) : null}
        {loading ? (
          <p className="py-4 text-body text-ink-secondary">Összeállítás…</p>
        ) : textIds.length === 0 ? (
          <p className="py-4 text-body text-ink-secondary">Nincs nyitott tétel, amit meg kellene rendelni.</p>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-auto">
            {blocks.map((b, i) => {
              const mailto = b.email ? buildMailtoHref({ to: b.email, subject: b.subject, body: b.text }) : null
              const tooLong = mailto !== null && mailto.length > MAILTO_MAX
              return (
                <section key={b.supplierName} className="space-y-1.5 rounded-md border border-border p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-h3 text-ink">
                        {b.supplierName}{' '}
                        <span className="text-hint font-normal text-ink-secondary">· {b.lineCount} tétel</span>
                      </h3>
                      <p className="text-hint text-ink-secondary">
                        {b.email ? `Címzett: ${b.email}` : 'Nincs e-mail cím a beszállítónál'}
                        {b.preferred ? ` · Szokásos csatorna: ${CHANNEL_LABEL[b.preferred]}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.phone ? (
                        <a
                          href={`tel:${b.phone.replace(/\s/g, '')}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[13px] text-ink hover:bg-subtle"
                        >
                          <Phone className="size-3.5" aria-hidden />
                          Felhívom
                        </a>
                      ) : null}
                      <Button type="button" size="sm" variant="secondary" onClick={() => void copy(b.text)}>
                        <Copy className="size-3.5" aria-hidden />
                        Másolás
                      </Button>
                      {mailto && !tooLong ? (
                        <a
                          href={mailto}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[13px] font-medium text-ink hover:bg-subtle"
                        >
                          <Mail className="size-3.5" aria-hidden />
                          E-mail megnyitása
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-hint text-ink-secondary">
                    {b.introSource === 'supplier'
                      ? 'Bevezető: a beszállító e-mail sablonja.'
                      : b.introSource === 'company'
                        ? 'Bevezető: a cég alap szövege (a beszállítónak nincs saját sablonja).'
                        : 'Bevezető: beépített szöveg.'}
                    {b.introSource !== 'supplier' && b.supplierId ? (
                      <>
                        {' '}
                        <Link href={`/beszallitok/${b.supplierId}`} className="text-ink underline-offset-2 hover:underline">
                          Sablon beállítása a beszállítónál
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {b.missingCodeCount > 0 ? (
                    <p className="text-hint text-warning-ink">
                      {b.missingCodeCount} sorban nincs cikkszám — ellenőrizd, hogy a beszállító azonosítani tudja.
                    </p>
                  ) : null}
                  {tooLong ? (
                    <p className="text-hint text-warning-ink">
                      Túl hosszú a levélprogramnak — másold ki, és illeszd be az e-mailbe ({b.email}).
                    </p>
                  ) : null}
                  <Textarea
                    value={b.text}
                    aria-label={`Rendelési szöveg — ${b.supplierName}`}
                    onChange={(e) =>
                      setBlocks((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                    }
                    className="min-h-[9rem] font-mono text-[13px]"
                  />
                  {b.links.length > 0 ? (
                    <div className="space-y-0.5">
                      <p className="text-hint font-medium text-ink-secondary">Webshop</p>
                      <ul className="space-y-0.5">
                        {b.links.map((l) => (
                          <li key={l.url}>
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-start gap-1 text-body text-ink underline-offset-2 hover:underline"
                            >
                              <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                              {l.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
        {markableIds.length > 0 ? (
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="size-3.5 accent-ink"
              checked={markAfter}
              onChange={(e) => setMarkAfter(e.target.checked)}
            />
            Bezáráskor a {markableIds.length} nyitott tétel legyen „Megrendelve”
          </label>
        ) : null}
        <DialogFooter>
          <Button type="button" loading={pending} onClick={finish}>
            {markAfter && markableIds.length > 0 ? 'Kész, megrendeltem' : 'Bezárás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Átadás
// ---------------------------------------------------------------------------

export type HandoverItem = {
  id: string
  name: string
  qty: number
  unitShortform: string
  ready: boolean
  statusLabel: string
}

const PAY_METHODS: MoDepositMethod[] = ['keszpenz', 'kartya', 'atutalas']

function ft(n: number) {
  return `${Math.round(n).toLocaleString('hu-HU')} Ft`
}

/**
 * Átadás + fizetés (Scanner minta): rendelésenként kiszámolt hátralék, fizetési mód,
 * „Fizetés rögzítése és átadás” vagy „Átadás fizetés nélkül”.
 */
export function HandoverDialog({
  open,
  onOpenChange,
  customerName,
  items,
  note,
  onDone
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  items: HandoverItem[]
  /** pl. „2 tétel még nem jött meg.” */
  note?: string | null
  onDone: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [dues, setDues] = useState<MoHandoverDue[] | null>(null)
  const [method, setMethod] = useState<MoDepositMethod>('keszpenz')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<'settle' | 'skip' | null>(null)

  useEffect(() => {
    if (!open) return
    setChecked(new Set(items.filter((i) => i.ready).map((i) => i.id)))
    setMethod('keszpenz')
    setError(null)
  }, [open, items])

  const checkedKey = [...checked].sort().join(',')
  useEffect(() => {
    if (!open) return
    if (!checkedKey) {
      setDues([])
      return
    }
    let alive = true
    setDues(null)
    void getHandoverDueAction({ itemIds: checkedKey.split(',') }).then((res) => {
      if (!alive) return
      if (!res.ok) {
        setError(res.message)
        setDues([])
        return
      }
      setDues(res.orders)
    })
    return () => {
      alive = false
    }
  }, [open, checkedKey])

  const totalDue = (dues ?? []).reduce((s, d) => s + d.due, 0)
  const totalOver = (dues ?? []).reduce((s, d) => s + d.overpaid, 0)
  const unpriced = (dues ?? []).reduce((s, d) => s + d.unpriced, 0)
  const hasDue = totalDue > 0
  const multi = (dues?.length ?? 0) > 1

  function run(settle: boolean) {
    setError(null)
    setMode(settle ? 'settle' : 'skip')
    startTransition(async () => {
      const res = await handoverManualItemsAction({ itemIds: [...checked], settle, method })
      setMode(null)
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success(res.message ?? `${res.changed ?? 0} tétel átadva — ${customerName}.`)
      onOpenChange(false)
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="max-w-[520px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Átadás · {customerName}</DialogTitle>
          <DialogDescription>Csak a megjött tételek adhatók át.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2.5 px-3 py-2 text-body">
              <input
                type="checkbox"
                className="size-3.5 accent-ink"
                disabled={!i.ready || pending}
                checked={checked.has(i.id)}
                onChange={() =>
                  setChecked((prev) => {
                    const next = new Set(prev)
                    if (next.has(i.id)) next.delete(i.id)
                    else next.add(i.id)
                    return next
                  })
                }
                aria-label={`${i.name} átadása`}
              />
              <span className={i.ready ? 'min-w-0 flex-1 text-ink' : 'min-w-0 flex-1 text-ink-muted'}>{i.name}</span>
              <span className="whitespace-nowrap tabular-nums text-ink-secondary">
                {moFmtQty(i.qty)} {i.unitShortform}
              </span>
              <span className="w-24 text-right text-hint text-ink-secondary">{i.statusLabel}</span>
            </li>
          ))}
        </ul>
        {note ? <p className="text-hint text-ink-secondary">{note}</p> : null}

        {checked.size > 0 ? (
          dues === null ? (
            <p className="text-body text-ink-secondary">Fizetendő számítása…</p>
          ) : (
            <div className="space-y-2.5">
              <div className="rounded-md border border-border bg-subtle px-3 py-2 text-body text-ink" role="status">
                <div className="flex items-baseline justify-between gap-2">
                  <span>Most fizetendő</span>
                  <span className="text-h3 font-semibold tabular-nums">{ft(totalDue)}</span>
                </div>
                {multi ? (
                  <ul className="mt-1 space-y-0.5 text-hint text-ink-secondary">
                    {dues.map((d) => (
                      <li key={d.orderId} className="flex justify-between gap-2">
                        <span>
                          {d.orderNumber} · {d.customerName}
                        </span>
                        <span className="tabular-nums">{ft(d.due)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 text-hint text-ink-secondary">Az előleg és a korábbi befizetések már levonva.</p>
                {unpriced > 0 ? (
                  <p className="mt-1 text-hint text-warning-ink">
                    {unpriced} tételnek nincs ára — azt kézzel számold el a kasszán.
                  </p>
                ) : null}
                {totalOver > 0 ? (
                  <p className="mt-1 text-hint text-warning-ink">Túlfizetés: {ft(totalOver)} — add vissza a vevőnek.</p>
                ) : null}
              </div>
              {hasDue ? (
                <div className="space-y-1.5">
                  <p id="mo-ho-method" className="text-label font-medium text-ink">
                    Fizetési mód
                  </p>
                  <div role="radiogroup" aria-labelledby="mo-ho-method" className="flex flex-wrap gap-1.5">
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={method === m}
                        disabled={pending}
                        onClick={() => setMethod(m)}
                        className={
                          method === m
                            ? 'h-8 rounded-md border border-ink bg-ink px-3 text-body text-white'
                            : 'h-8 rounded-md border border-border bg-white px-3 text-body text-ink hover:bg-subtle'
                        }
                      >
                        {MO_DEPOSIT_METHOD_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          {hasDue ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending || checked.size === 0}
              loading={mode === 'skip'}
              onClick={() => run(false)}
            >
              Átadás fizetés nélkül
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={pending || checked.size === 0 || dues === null}
            loading={mode === (hasDue ? 'settle' : 'skip')}
            onClick={() => run(hasDue)}
          >
            {hasDue ? `${ft(totalDue)} rögzítése és átadás` : `${checked.size} tétel átadása`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Részszállítás
// ---------------------------------------------------------------------------

/** Hány jött meg? → bontás, utána a hívó a megjött részre nyitja a „Megjött + SMS” ablakot. */
export function PartialArrivalDialog({
  item,
  onClose,
  onSplit
}: {
  item: { id: string; name: string; qty: number; unitShortform: string }
  onClose: () => void
  onSplit: (arrivedItemId: string) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const arrived = Number(value.replace(',', '.'))
  const valid = Number.isFinite(arrived) && arrived > 0 && arrived < item.qty

  function save() {
    if (!valid) {
      setError(`0 és ${moFmtQty(item.qty)} közötti szám kell (ha mind megjött, használd a „Megjött” gombot).`)
      return
    }
    startTransition(async () => {
      const res = await splitManualItemAction({ itemId: item.id, arrivedQty: arrived })
      if (!res.ok) {
        setError(res.message)
        return
      }
      onSplit(item.id)
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Részben jött meg</DialogTitle>
          <DialogDescription>
            {item.name} — rendelve {moFmtQty(item.qty)} {item.unitShortform}. A maradék „Úton” marad.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <FormField label="Megjött mennyiség" htmlFor="mo-partial-qty" required error={error ?? undefined}>
            <div className="flex items-center gap-2">
              <Input
                id="mo-partial-qty"
                inputMode="decimal"
                autoFocus
                className="w-32 text-right tabular-nums"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  setError(null)
                }}
              />
              <span className="text-body text-ink-secondary">{item.unitShortform}</span>
              {valid ? (
                <span className="text-hint text-ink-secondary">
                  úton marad: {moFmtQty(Math.round((item.qty - arrived) * 1000) / 1000)} {item.unitShortform}
                </span>
              ) : null}
            </div>
          </FormField>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" loading={pending}>
              Tovább: Megjött
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
