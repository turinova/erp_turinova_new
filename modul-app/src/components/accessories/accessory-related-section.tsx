'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import {
  addRelatedProduct,
  getRelatedProducts,
  removeRelatedProduct,
  searchRelatedCandidates,
  type RelatedGroups,
  type RelatedProduct
} from '@/lib/accessories/related-actions'
import {
  isRelatedKind,
  RELATED_KIND_META,
  RELATED_KINDS,
  type RelatedKind
} from '@/lib/accessories/related-kinds'

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

const EMPTY: RelatedGroups = { required: [], accessory: [], alternative: [], larger_pack: [] }

const KIND_OPTIONS = RELATED_KINDS.map((k) => ({
  value: k,
  label: RELATED_KIND_META[k].label,
  hint: RELATED_KIND_META[k].description
}))

/** Kapcsolódó termékek — a termékoldalon sávként, a gépi adatokban kapcsolatként jelennek meg. */
export function AccessoryRelatedSection({
  accessoryId,
  disabled,
  embedded = false
}: {
  accessoryId: string
  disabled: boolean
  embedded?: boolean
}) {
  const [groups, setGroups] = useState<RelatedGroups>(EMPTY)
  const [kind, setKind] = useState<RelatedKind>('required')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<RelatedProduct[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let alive = true
    void getRelatedProducts(accessoryId).then((r) => {
      if (alive && r.ok) setGroups(r.groups)
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
      const r = await searchRelatedCandidates(accessoryId, term)
      if (alive && r.ok) setResults(r.items)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, accessoryId])

  function add(id: string) {
    startTransition(async () => {
      const r = await addRelatedProduct(accessoryId, id, kind)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setGroups(r.groups)
      setQ('')
      toast.success(`Hozzáadva: ${RELATED_KIND_META[kind].label}.`)
    })
  }

  function remove(id: string, from: RelatedKind) {
    startTransition(async () => {
      const r = await removeRelatedProduct(accessoryId, id, from)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      setGroups(r.groups)
      toast.success('Kapcsolat eltávolítva.')
    })
  }

  const linked = new Set(RELATED_KINDS.flatMap((k) => groups[k].map((i) => i.id)))
  const filled = RELATED_KINDS.filter((k) => groups[k].length > 0)

  return (
    <FormSection
      embedded={embedded}
      title="Kapcsolódó termékek"
      description="A termékoldalon a vásárló, a gépi adatokban az AI keresők látják, mi kell hozzá, mi illik hozzá és mi helyettesítheti."
      columns={2}
    >
      <FormField
        label="Kapcsolat típusa"
        htmlFor="related-kind"
        hint={RELATED_KIND_META[kind].description}
      >
        <MenuSelect
          id="related-kind"
          value={kind}
          onChange={(v) => {
            if (isRelatedKind(v)) setKind(v)
          }}
          disabled={disabled || pending}
          options={KIND_OPTIONS}
        />
      </FormField>
      <FormField label="Termék hozzáadása" htmlFor="related-search" optionalLabel>
        <Input
          id="related-search"
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
                disabled={disabled || pending || linked.has(r.id)}
                onClick={() => add(r.id)}
              >
                <Plus className="size-3.5" aria-hidden />
                {linked.has(r.id) ? 'Már kapcsolva' : `Hozzáadás: ${RELATED_KIND_META[kind].label}`}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {filled.length === 0 ? (
        <p className="col-span-full text-hint text-ink-secondary">
          Még nincs kapcsolódó termék. Válassz típust, majd keress rá a termékre.
        </p>
      ) : (
        <div className="col-span-full space-y-3">
          {filled.map((k) => (
            <div key={k} className="space-y-1">
              <p className="text-label font-semibold text-ink">
                {RELATED_KIND_META[k].label}{' '}
                <span className="font-normal tabular-nums text-ink-secondary">
                  {groups[k].length}
                </span>
              </p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {groups[k].map((r) => (
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
                      onClick={() => remove(r.id, k)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Eltávolítás
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </FormSection>
  )
}
