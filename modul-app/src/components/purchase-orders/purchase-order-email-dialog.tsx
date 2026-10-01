'use client'

import { useMemo, useState, useTransition } from 'react'
import { Copy, Mail } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { markPurchaseOrderEmailPrepared } from '@/lib/purchase-orders/actions'
import {
  buildMailtoHref,
  buildPurchaseOrderEmailPlainBody
} from '@/lib/suppliers/order-channels'

export type PoEmailLine = {
  name: string
  sku: string | null
  quantity: number
  unit: string
  lineKind: string
}

type PurchaseOrderEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  poId: string | null
  poNumber: string | null
  supplierName: string
  supplierEmail: string | null
  introHtml: string | null
  items: PoEmailLine[]
  canMarkSent: boolean
  onMarkedSent?: () => void
}

export function PurchaseOrderEmailDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  supplierName,
  supplierEmail,
  introHtml,
  items,
  canMarkSent,
  onMarkedSent
}: PurchaseOrderEmailDialogProps) {
  const [pending, startTransition] = useTransition()
  const [to, setTo] = useState(supplierEmail ?? '')
  const [includeSku, setIncludeSku] = useState(true)

  const openKey = `${open}:${supplierEmail ?? ''}:${poId ?? ''}`
  const [lastKey, setLastKey] = useState(openKey)
  if (openKey !== lastKey) {
    setLastKey(openKey)
    setTo(supplierEmail ?? '')
  }

  const subject = poNumber
    ? `Beszállítói rendelés — ${poNumber}`
    : `Beszállítói rendelés — ${supplierName}`

  const body = useMemo(
    () =>
      buildPurchaseOrderEmailPlainBody({
        intro: introHtml,
        poNumber,
        includeSku,
        items: items.map((it) => ({
          name: it.name,
          sku: it.sku,
          quantity: it.quantity,
          unit: it.unit,
          includeSku: it.lineKind === 'accessory'
        }))
      }),
    [introHtml, poNumber, includeSku, items]
  )

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(body)
      toast.success('E-mail szöveg a vágólapra másolva.')
    } catch {
      toast.error('Nem sikerült a vágólapra másolni.')
    }
  }

  function openMailto() {
    if (!to.trim()) {
      toast.error('Add meg a címzett e-mail címet.')
      return
    }
    window.location.href = buildMailtoHref({
      to: to.trim(),
      subject,
      body
    })
  }

  function markSent() {
    if (!poId || !canMarkSent) return
    startTransition(async () => {
      const result = await markPurchaseOrderEmailPrepared(poId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('E-mail elküldve jelölve.')
      onMarkedSent?.()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Rendelés e-mail</DialogTitle>
          <DialogDescription>
            {poNumber
              ? `${poNumber} — ${supplierName}. Másold vagy nyisd meg a levelezőben. A rendelés státusza nem változik.`
              : `${supplierName}. Előbb mentsd a rendelést, ha rendelésszámot is szeretnél a levélben.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Címzett" htmlFor="po-email-to">
            <Input
              id="po-email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="beszallito@pelda.hu"
            />
          </FormField>
          <FormField label="Tárgy" htmlFor="po-email-subject">
            <Input id="po-email-subject" value={subject} readOnly />
          </FormField>
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              className="size-3.5 rounded border-border"
              checked={includeSku}
              onChange={(e) => setIncludeSku(e.target.checked)}
            />
            Termék SKU a listában
          </label>
          <FormField label="Szöveg" htmlFor="po-email-body">
            <Textarea
              id="po-email-body"
              value={body}
              readOnly
              rows={10}
              className="font-mono text-[12.5px]"
            />
          </FormField>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={copyBody}>
              <Copy className="size-3.5" aria-hidden />
              Másolás
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={openMailto}
              disabled={!to.trim() || items.length === 0}
            >
              <Mail className="size-3.5" aria-hidden />
              Megnyitás levelezőben
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {poId && canMarkSent ? (
              <Button
                type="button"
                variant="secondary"
                loading={pending}
                onClick={markSent}
              >
                Elküldve jelölés
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Bezárás
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
