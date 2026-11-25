'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CustomerMenuSelect } from '@/components/customers/customer-menu-select'
import {
  addManualOrderItemsAction,
  resendManualOrderSmsAction,
  setManualItemsStatusAction,
  setManualOrderCustomerAction,
  updateManualOrderBillingAction,
  updateManualOrderHeaderAction,
  updateManualOrderItemAction
} from '@/lib/manual-orders/actions'
import {
  MO_ITEM_STATUS_LABEL,
  type MoBilling,
  type MoDetail,
  type MoItem,
  type MoItemStatus
} from '@/lib/manual-orders/types'

type SupplierOpt = { id: string; name: string }

export function EditHeaderDialog({
  order,
  readyCount,
  onClose
}: {
  order: MoDetail
  readyCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState(order.customerId ?? '')
  const [name, setName] = useState(order.customerName)
  const [mobile, setMobile] = useState(order.customerMobile ?? '')
  const [note, setNote] = useState(order.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      if (customerId && customerId !== order.customerId) {
        const c = await setManualOrderCustomerAction({ orderId: order.id, customerId })
        if (!c.ok) {
          toast.error(c.message)
          return
        }
      }
      const res = await updateManualOrderHeaderAction({
        orderId: order.id,
        customerName: name,
        customerMobile: mobile,
        note
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.message)
        return
      }
      onClose()
      router.refresh()
      const mobileChanged = mobile.trim() !== (order.customerMobile ?? '') && mobile.trim() !== ''
      if (mobileChanged && readyCount > 0) {
        toast.success('Mentve. A vevőnek van átvehető tétele.', {
          duration: 10_000,
          action: {
            label: 'SMS újraküldése',
            onClick: () =>
              void resendManualOrderSmsAction({ orderId: order.id }).then((r) =>
                r.ok ? toast.success(r.message ?? 'SMS elküldve.') : toast.error(r.message)
              )
          }
        })
      } else {
        toast.success('Mentve.')
      }
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Adatok szerkesztése</DialogTitle>
          <DialogDescription>Válassz ügyfelet az adatbázisból, vagy írd át kézzel a nevet és a mobilt.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <FormField label="Ügyfél az adatbázisból" htmlFor="mo-e-customer" optionalLabel>
            <CustomerMenuSelect
              id="mo-e-customer"
              value={customerId}
              placeholder="Név vagy telefonszám…"
              onChange={(id, c) => {
                setCustomerId(id)
                if (c) {
                  setName(c.name)
                  setMobile(c.mobile ?? '')
                }
              }}
            />
          </FormField>
          {order.smsSentAt && customerId !== (order.customerId ?? '') ? (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-hint text-warning-ink">
              Már ment SMS {order.customerName} részére. Csere után szükség esetén küldd újra.
            </p>
          ) : null}
          <FormField label="Vevő neve" htmlFor="mo-e-name" required error={errors.customerName}>
            <Input id="mo-e-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Mobil" htmlFor="mo-e-mobile" error={errors.customerMobile}>
            <Input id="mo-e-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </FormField>
          <FormField label="Megjegyzés" htmlFor="mo-e-note" optionalLabel>
            <Textarea id="mo-e-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" loading={pending}>
              Mentés
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddItemDialog({
  orderId,
  suppliers,
  onClose
}: {
  orderId: string
  suppliers: SupplierOpt[]
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('db')
  const [price, setPrice] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    if (!supplierId) {
      setError('Válassz beszállítót.')
      return
    }
    startTransition(async () => {
      const res = await addManualOrderItemsAction({
        orderId,
        items: [
          {
            name,
            qty: Number(qty.replace(',', '.')),
            unitShortform: unit,
            unitPriceGross: price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : null,
            supplierId
          }
        ]
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success('Tétel hozzáadva.')
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Tétel hozzáadása</DialogTitle>
          <DialogDescription>Az új tétel „Nyitott” állapotban kerül a rendelésbe.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <FormField label="Termék" htmlFor="mo-a-name" required>
            <Input id="mo-a-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Menny." htmlFor="mo-a-qty" required>
              <Input id="mo-a-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </FormField>
            <FormField label="Egység" htmlFor="mo-a-unit">
              <Input id="mo-a-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </FormField>
            <FormField label="Br. egységár" htmlFor="mo-a-price" optionalLabel>
              <Input id="mo-a-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Beszállító" htmlFor="mo-a-sup" required>
            <Select id="mo-a-sup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Válassz…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          {error ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Hozzáadás
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const PREV_STATUS: Partial<Record<MoItemStatus, MoItemStatus>> = {
  megrendelve: 'nyitott',
  megerkezett: 'megrendelve',
  atadva: 'megerkezett',
  torolve: 'nyitott'
}

export function EditItemDialog({
  item,
  suppliers,
  onClose
}: {
  item: MoItem
  suppliers: SupplierOpt[]
  onClose: () => void
}) {
  const router = useRouter()
  const editable = item.status !== 'atadva' && item.status !== 'torolve'
  const coreLocked = item.status === 'megerkezett' || !editable
  const [name, setName] = useState(item.name)
  const [qty, setQty] = useState(String(item.qty).replace('.', ','))
  const [unit, setUnit] = useState(item.unitShortform)
  const [price, setPrice] = useState(item.unitPriceGross == null ? '' : String(item.unitPriceGross))
  const [supplierId, setSupplierId] = useState(item.supplierId ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const prev = PREV_STATUS[item.status]

  function save() {
    if (!supplierId) {
      setError('Válassz beszállítót.')
      return
    }
    startTransition(async () => {
      const res = await updateManualOrderItemAction({
        itemId: item.id,
        item: {
          name,
          sku: item.sku,
          qty: Number(qty.replace(',', '.')),
          unitShortform: unit,
          unitPriceGross: price.trim() ? Number(price.replace(/\s/g, '').replace(',', '.')) : null,
          accessoryId: item.accessoryId,
          supplierId,
          note
        }
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success('Tétel mentve.')
      onClose()
      router.refresh()
    })
  }

  function revert() {
    if (!prev) return
    startTransition(async () => {
      const res = await setManualItemsStatusAction({ itemIds: [item.id], status: prev })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success(`Visszaállítva: ${MO_ITEM_STATUS_LABEL[prev]}.`)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Tétel szerkesztése</DialogTitle>
          <DialogDescription>
            Állapot: {MO_ITEM_STATUS_LABEL[item.status]}
            {item.status === 'megerkezett' ? ' — a polcon van, csak az ár és a megjegyzés módosítható.' : ''}
            {!editable ? ' — nem módosítható, csak az állapot állítható vissza.' : ''}
          </DialogDescription>
        </DialogHeader>
        {item.status === 'megrendelve' ? (
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
            Már megrendelted. Ha a mennyiséget vagy a beszállítót módosítod, szólj a beszállítónak is.
          </p>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (editable) save()
          }}
        >
          <FormField label="Termék" htmlFor="mo-ei-name" required>
            <Input id="mo-ei-name" value={name} disabled={coreLocked || Boolean(item.accessoryId)} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Menny." htmlFor="mo-ei-qty" required>
              <Input id="mo-ei-qty" inputMode="decimal" value={qty} disabled={coreLocked} onChange={(e) => setQty(e.target.value)} />
            </FormField>
            <FormField label="Egység" htmlFor="mo-ei-unit">
              <Input id="mo-ei-unit" value={unit} disabled={coreLocked || Boolean(item.accessoryId)} onChange={(e) => setUnit(e.target.value)} />
            </FormField>
            <FormField label="Br. egységár" htmlFor="mo-ei-price" optionalLabel>
              <Input id="mo-ei-price" inputMode="numeric" value={price} disabled={!editable} onChange={(e) => setPrice(e.target.value)} />
            </FormField>
          </div>
          <FormField label="Beszállító" htmlFor="mo-ei-sup" required>
            <Select id="mo-ei-sup" value={supplierId} disabled={coreLocked} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Válassz…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Megjegyzés" htmlFor="mo-ei-note" optionalLabel>
            <Input id="mo-ei-note" value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          {error ? (
            <p className="text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="flex-wrap gap-1.5 sm:justify-between">
            {prev ? (
              <Button variant="ghost" disabled={pending} onClick={revert}>
                Vissza: {MO_ITEM_STATUS_LABEL[prev]}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              <Button variant="secondary" disabled={pending} onClick={onClose}>
                Mégse
              </Button>
              {editable ? (
                <Button type="submit" loading={pending} disabled={!name.trim()}>
                  Mentés
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ChangeCustomerDialog({
  order,
  onClose
}: {
  order: MoDetail
  onClose: () => void
}) {
  const router = useRouter()
  const [customerId, setCustomerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await setManualOrderCustomerAction({ orderId: order.id, customerId })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success('Vevő cserélve.')
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Másik vevő</DialogTitle>
          <DialogDescription>A rendelés, a tételek és az előleg maradnak — csak a vevő cserélődik.</DialogDescription>
        </DialogHeader>
        {order.smsSentAt ? (
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-ink">
            Már ment SMS {order.customerName} részére. Csere után szükség esetén küldd újra.
          </p>
        ) : null}
        <FormField label="Új vevő" htmlFor="mo-cc-customer" required>
          <CustomerMenuSelect
            id="mo-cc-customer"
            value={customerId}
            allowEmpty={false}
            placeholder="Név vagy telefonszám…"
            onChange={(id) => {
              setCustomerId(id)
              setError(null)
            }}
          />
        </FormField>
        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Mégse
          </Button>
          <Button loading={pending} disabled={!customerId || customerId === order.customerId} onClick={save}>
            Vevő cseréje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BillingDialog({
  orderId,
  billing,
  customerName,
  onClose
}: {
  orderId: string
  billing: MoBilling | null
  customerName: string
  onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState<MoBilling>(
    billing ?? { name: customerName, postalCode: '', city: '', street: '', houseNumber: '', taxNumber: '' }
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function field(key: keyof MoBilling, label: string, opts: { required?: boolean; className?: string; inputMode?: 'numeric' } = {}) {
    return (
      <FormField label={label} htmlFor={`mo-b-${key}`} required={opts.required} optionalLabel={!opts.required} className={opts.className}>
        <Input
          id={`mo-b-${key}`}
          value={f[key]}
          inputMode={opts.inputMode}
          disabled={pending}
          onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
        />
      </FormField>
    )
  }

  function save() {
    startTransition(async () => {
      const res = await updateManualOrderBillingAction({ orderId, billing: f })
      if (!res.ok) {
        setError(res.message)
        return
      }
      toast.success('Számlázási adatok mentve.')
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Számlázási adatok</DialogTitle>
          <DialogDescription>Az ügyfél adatlapján is frissül — a kassza ebből számláz.</DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-6 gap-x-2 gap-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {field('name', 'Számlázási név', { required: true, className: 'col-span-6' })}
          {field('postalCode', 'Irsz.', { className: 'col-span-2', inputMode: 'numeric' })}
          {field('city', 'Település', { className: 'col-span-4' })}
          {field('street', 'Utca', { className: 'col-span-4' })}
          {field('houseNumber', 'Házszám', { className: 'col-span-2' })}
          {field('taxNumber', 'Adószám', { className: 'col-span-6' })}
          {error ? (
            <p className="col-span-6 text-body text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="col-span-6">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" loading={pending} disabled={!f.name.trim()}>
              Mentés
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
