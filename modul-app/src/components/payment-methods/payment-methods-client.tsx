'use client'

import { useMemo, useState, useTransition } from 'react'
import { CreditCard } from 'lucide-react'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow
} from '@/components/patterns/data-table'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  setDefaultPaymentMethod,
  setPaymentMethodActive,
  updatePaymentMethod
} from '@/lib/payment-methods/actions'
import type { PaymentMethodListItem } from '@/lib/payment-methods/queries'

type PaymentMethodsClientProps = {
  initialRows: PaymentMethodListItem[]
  canWrite: boolean
}

export function PaymentMethodsClient({
  initialRows,
  canWrite
}: PaymentMethodsClientProps) {
  const [editRow, setEditRow] = useState<PaymentMethodListItem | null>(null)
  const [comment, setComment] = useState('')
  const [active, setActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [partnerVisible, setPartnerVisible] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const activeCount = useMemo(
    () => initialRows.filter((r) => r.active).length,
    [initialRows]
  )

  function openEdit(row: PaymentMethodListItem) {
    setComment(row.comment ?? '')
    setActive(row.active)
    setIsDefault(row.is_default)
    setPartnerVisible(row.partner_visible)
    setFieldErrors({})
    setEditRow(row)
  }

  function closeEditor() {
    if (pending) return
    setEditRow(null)
    setFieldErrors({})
  }

  function handleSave() {
    if (!editRow) return
    startTransition(async () => {
      const result = await updatePaymentMethod({
        id: editRow.id,
        comment,
        active,
        isDefault,
        partnerVisible
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success('Fizetési mód mentve.')
      setEditRow(null)
      setFieldErrors({})
    })
  }

  function handleToggleActive(row: PaymentMethodListItem) {
    if (!canWrite || pending) return
    startTransition(async () => {
      const result = await setPaymentMethodActive(row.id, !row.active)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(
        row.active ? `„${row.name}” kikapcsolva.` : `„${row.name}” bekapcsolva.`
      )
    })
  }

  function handleSetDefault(row: PaymentMethodListItem) {
    if (!canWrite || row.is_default || pending) return
    startTransition(async () => {
      const result = await setDefaultPaymentMethod(row.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`„${row.name}” az alapértelmezett.`)
    })
  }

  const editingLegacy = Boolean(editRow && !editRow.kind)
  const editingOnlyActive =
    Boolean(editRow?.is_default) && activeCount <= 1

  return (
    <div>
      <PageHeader
        title="Fizetési módok"
        description="Fix lista. Kapcsold be, amit használsz. Az alapértelmezett mód a választólistákban elöl jelenik meg."
      />

      {initialRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-4 py-10 text-center">
          <CreditCard className="size-8 text-ink-secondary" aria-hidden />
          <p className="max-w-sm text-body text-ink-secondary">
            Még nincsenek fizetési módok ennél a cégnél. Frissítsd az oldalt,
            vagy szólj az ügyfélszolgálatnak.
          </p>
        </div>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Megjegyzés</DataTableHeaderCell>
              <DataTableHeaderCell>Partner portál</DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="w-[1%] whitespace-nowrap text-right">
                Műveletek
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {initialRows.map((row) => {
              const legacy = !row.kind
              return (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{row.name}</span>
                      {row.is_default ? (
                        <StatusBadge tone="info">Alap</StatusBadge>
                      ) : null}
                      {legacy ? (
                        <StatusBadge tone="neutral">Régi mód</StatusBadge>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="max-w-[280px] truncate text-ink-secondary">
                    {row.comment || 'Nincs'}
                  </DataTableCell>
                  <DataTableCell className="text-ink-secondary">
                    {row.partner_visible ? 'Választható' : 'Rejtett'}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Aktív' : 'Kikapcsolva'}
                    </StatusBadge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite ? (
                        <>
                          {!row.is_default && !legacy ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => handleSetDefault(row)}
                            >
                              Alapnak
                            </Button>
                          ) : null}
                          {row.active || !legacy ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={pending || (row.active && row.is_default)}
                              title={
                                row.active && row.is_default
                                  ? 'Előbb jelölj ki másik alapértelmezettet.'
                                  : undefined
                              }
                              onClick={() => handleToggleActive(row)}
                            >
                              {row.active ? 'Kikapcsolás' : 'Bekapcsolás'}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            Szerkesztés
                          </Button>
                        </>
                      ) : (
                        <span className="text-hint text-ink-secondary">
                          Csak olvasás
                        </span>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={Boolean(editRow)}
        onOpenChange={(open) => {
          if (!open) closeEditor()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editRow?.name ?? 'Fizetési mód'}</DialogTitle>
            <DialogDescription>
              A név fix. A megjegyzést, a láthatóságot és az állapotot
              állíthatod.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField
              label="Megjegyzés"
              htmlFor="payment-method-comment"
              hint="A partner is látja beküldéskor. Ide írhatod például a bankszámlaszámot."
              error={fieldErrors.comment}
            >
              <Textarea
                id="payment-method-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={pending}
              />
            </FormField>

            <Switch
              id="payment-method-active"
              checked={active}
              disabled={
                pending ||
                (editingLegacy && !editRow?.active) ||
                (isDefault && editingOnlyActive)
              }
              onCheckedChange={(next) => {
                setActive(next)
                if (!next) setIsDefault(false)
              }}
              label="Aktív"
              description="Választható megrendeléskor és befizetésnél."
            />
            {fieldErrors.active ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.active}
              </p>
            ) : null}

            <Switch
              id="payment-method-partner"
              checked={partnerVisible}
              disabled={pending}
              onCheckedChange={setPartnerVisible}
              label="Partner is választhatja"
              description="Megjelenik a partner portálon beküldéskor, ha aktív."
            />

            <Switch
              id="payment-method-default"
              checked={isDefault}
              disabled={pending || editingLegacy || Boolean(editRow?.is_default)}
              onCheckedChange={(next) => {
                setIsDefault(next)
                if (next) setActive(true)
              }}
              label="Alapértelmezett"
              description="Megrendelés, befizetés és átadás választólistáiban ez az első."
            />
            {fieldErrors.isDefault ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.isDefault}
              </p>
            ) : null}
            {editRow?.is_default ? (
              <p className="text-hint text-ink-muted">
                Az alapjelölést úgy veszed le, hogy a listán egy másik módnál
                az „Alapnak” gombra kattintasz.
              </p>
            ) : null}
            {editingLegacy ? (
              <p className="text-hint text-ink-muted">
                Ez egy régi, egyedi fizetési mód. Kikapcsolhatod, de újra
                bekapcsolni már nem lehet.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={closeEditor}
            >
              Mégse
            </Button>
            <Button
              type="button"
              disabled={pending}
              loading={pending}
              onClick={handleSave}
            >
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
