'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerInvoicePaymentAction } from '@/lib/finance/actions'
import type { InvoicePaymentMethod } from '@/lib/invoicing/types'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  invoiceId: string
  openAmount: number
  customerName: string | null
  invoiceLabel: string
  onClose: () => void
}

const METHODS: { value: InvoicePaymentMethod | 'other'; label: string }[] = [
  { value: 'bank_transfer', label: 'Átutalás' },
  { value: 'cash', label: 'Készpénz' },
  { value: 'card', label: 'Bankkártya' },
  { value: 'other', label: 'Egyéb' }
]

export function RegisterPaymentDialog({
  invoiceId,
  openAmount,
  customerName,
  invoiceLabel,
  onClose
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [amount, setAmount] = useState(String(openAmount))
  const [paidAt, setPaidAt] = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [method, setMethod] = useState<InvoicePaymentMethod | 'other'>(
    'bank_transfer'
  )
  const [note, setNote] = useState('')
  const [syncAgent, setSyncAgent] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await registerInvoicePaymentAction({
        invoiceId,
        amount: Number(amount.replace(/\s/g, '').replace(',', '.')),
        paidAt,
        method,
        note: note.trim() || undefined,
        syncAgent
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-title"
    >
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-4 shadow-elev3">
        <h2 id="pay-title" className="text-[15px] font-semibold text-ink">
          Fizetés rögzítése
        </h2>
        <p className="mt-1 text-hint text-ink-secondary">
          {invoiceLabel}
          {customerName ? ` · ${customerName}` : ''}
        </p>
        <p className="mt-0.5 text-hint text-ink-muted">
          Fennmaradó: {formatMoneyFt(openAmount)} Ft
        </p>

        <div className="mt-3 space-y-2.5">
          <div>
            <Label htmlFor="pay-amount">Összeg (Ft)</Label>
            <Input
              id="pay-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pay-date">Dátum</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="pay-method">Mód</Label>
            <select
              id="pay-method"
              className="mt-1 flex h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px]"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as InvoicePaymentMethod | 'other')
              }
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pay-note">Megjegyzés</Label>
            <Input
              id="pay-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
            <input
              type="checkbox"
              checked={syncAgent}
              onChange={(e) => setSyncAgent(e.target.checked)}
            />
            Szinkron a Számlázz.hu-ra (kifiz Agent)
          </label>
        </div>

        {error ? (
          <p className="mt-2 rounded-md border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-hint text-danger-ink">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            Mégse
          </Button>
          <Button type="button" onClick={submit} loading={pending}>
            Rögzítés
          </Button>
        </div>
      </div>
    </div>
  )
}
