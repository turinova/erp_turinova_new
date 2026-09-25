'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addRequiredProduct,
  getRequiredProducts,
  removeRequiredProduct,
  searchRequiredCandidates,
  type RelatedProduct
} from '@/lib/accessories/related-actions'

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="size-8 shrink-0 overflow-hidden rounded border border-border bg-surface">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : null}
    </span>
  )
}

/** „Kell hozzá” — a termékoldalon a vásárló és az AI is látja, mi kell még a szereléshez. */
export function AccessoryRequiredSection({
  accessoryId,
  disabled
}: {
  accessoryId: string
  disabled: boolean
}) {
  const [items, setItems] = useState<RelatedProduct[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<RelatedProduct[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    void getRequiredProducts(accessoryId).then((r) => {
      if (alive && r.ok) setItems(r.items)
    })
    return () => {
      alive = false
    }
  }, [accessoryId])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      const r = await searchRequiredCandidates(accessoryId, term)
      if (alive && r.ok) setResults(r.items)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, accessoryId])

  function add(id: string) {
    startTransition(async () => {
      const r = await addRequiredProduct(accessoryId, id)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setItems(r.items)
      setQ('')
      toast.success('Kiegészítő hozzáadva.')
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await removeRequiredProduct(accessoryId, id)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setItems(r.items)
      toast.success('Kiegészítő eltávolítva.')
    })
  }

  const selected = new Set(items.map((i) => i.id))

  return (
    <FormSection
      title="Kell hozzá"
      description="Amit a vásárlónak még meg kell vennie a szereléshez (pl. csavar, takarósapka). A termékoldalon a vásárlás mellett jelenik meg."
      columns={2}
    >
      <FormField label="Termék hozzáadása" htmlFor="required-search" optionalLabel>
        <Input
          id="required-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Név vagy cikkszám"
          disabled={disabled || pending}
          autoComplete="off"
        />
      </FormField>

      {results.length > 0 ? (
        <ul className="col-span-full divide-y divide-border rounded-md border border-border">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
              <Thumb url={r.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{r.name}</span>
                <span className="text-hint text-ink-secondary">{r.sku}</span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || pending || selected.has(r.id)}
                onClick={() => add(r.id)}
              >
                <Plus className="size-3.5" aria-hidden />
                {selected.has(r.id) ? 'Hozzáadva' : 'Hozzáadás'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length === 0 ? (
        <p className="col-span-full text-hint text-ink-secondary">
          Nincs megadva. Ha a termék magában is felszerelhető, hagyd üresen.
        </p>
      ) : (
        <ul className="col-span-full divide-y divide-border rounded-md border border-border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
              <Thumb url={r.imageUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{r.name}</span>
                <span className="text-hint text-ink-secondary">{r.sku}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger-ink"
                disabled={disabled || pending}
                onClick={() => remove(r.id)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Eltávolítás
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  )
}
