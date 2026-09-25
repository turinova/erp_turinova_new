'use client'

import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function toRows(raw: string): string[] {
  const rows = raw.split('\n')
  return rows.length > 0 ? rows : ['']
}

/** Soronként egy elem, a nyers szöveg `\n`-nel tárolva (üres sor szerkesztés közben megmarad). */
export function ListEditor({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  addLabel,
  max = 20,
  maxLength = 120
}: {
  id: string
  value: string
  onChange: (raw: string) => void
  disabled?: boolean
  placeholder?: string
  addLabel: string
  max?: number
  maxLength?: number
}) {
  const rows = toRows(value)
  const set = (next: string[]) => onChange(next.join('\n'))

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1.5">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <Input
              id={index === 0 ? id : `${id}-${index}`}
              aria-label={index === 0 ? undefined : `${index + 1}. sor`}
              value={row}
              maxLength={maxLength}
              disabled={disabled}
              placeholder={index === 0 ? placeholder : undefined}
              onChange={(e) => {
                const next = [...rows]
                next[index] = e.target.value.replace(/\n/g, ' ')
                set(next)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rows.length < max) {
                  e.preventDefault()
                  const next = [...rows]
                  next.splice(index + 1, 0, '')
                  set(next)
                  requestAnimationFrame(() =>
                    document.getElementById(`${id}-${index + 1}`)?.focus()
                  )
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${index + 1}. sor törlése`}
              disabled={disabled || (rows.length === 1 && !row)}
              onClick={() => set(rows.length === 1 ? [''] : rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      {rows.length < max ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => {
            set([...rows, ''])
            requestAnimationFrame(() => document.getElementById(`${id}-${rows.length}`)?.focus())
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </div>
  )
}

type TierRow = { qty: string; price: string }

function parseTierRows(raw: string): TierRow[] {
  const rows = raw
    .split('\n')
    .map((line) => {
      const [qty = '', price = ''] = line.split('=').map((s) => s.trim())
      return { qty, price }
    })
  return rows.length > 0 ? rows : [{ qty: '', price: '' }]
}

/** Mennyiségi ár: „darabtól” + „nettó egységár” párok; tárolás a meglévő `10 = 1800` sorformátumban. */
export function PriceTierEditor({
  value,
  onChange,
  disabled,
  unit
}: {
  value: string
  onChange: (raw: string) => void
  disabled?: boolean
  unit: string
}) {
  const rows = value.trim() ? parseTierRows(value) : []
  const set = (next: TierRow[]) =>
    onChange(next.map((r) => `${r.qty} = ${r.price}`).join('\n'))

  return (
    <div className="space-y-1.5">
      {rows.length > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1.5">
          <span className="text-label text-ink-secondary">Hány {unit}-tól</span>
          <span className="text-label text-ink-secondary">Nettó egységár (Ft)</span>
          <span />
          {rows.map((row, index) => (
            <TierInputs
              key={index}
              index={index}
              row={row}
              disabled={disabled}
              onChange={(r) => {
                const next = [...rows]
                next[index] = r
                set(next)
              }}
              onRemove={() => set(rows.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      ) : null}
      {rows.length < 10 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={() => set([...rows, { qty: '', price: '' }])}
        >
          <Plus className="size-3.5" aria-hidden />
          Mennyiségi ár hozzáadása
        </Button>
      ) : null}
    </div>
  )
}

function TierInputs({
  index,
  row,
  disabled,
  onChange,
  onRemove
}: {
  index: number
  row: TierRow
  disabled?: boolean
  onChange: (r: TierRow) => void
  onRemove: () => void
}) {
  return (
    <>
      <Input
        aria-label={`${index + 1}. sáv: darabtól`}
        value={row.qty}
        inputMode="numeric"
        disabled={disabled}
        placeholder="10"
        onChange={(e) => onChange({ ...row, qty: e.target.value.replace(/[^\d]/g, '') })}
      />
      <Input
        aria-label={`${index + 1}. sáv: nettó egységár`}
        value={row.price}
        inputMode="numeric"
        disabled={disabled}
        placeholder="1800"
        onChange={(e) => onChange({ ...row, price: e.target.value.replace(/[^\d]/g, '') })}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`${index + 1}. sáv törlése`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </>
  )
}
