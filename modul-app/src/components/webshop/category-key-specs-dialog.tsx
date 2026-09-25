'use client'

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
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
import { applyKeySpecPreset, saveCategoryTemplate } from '@/lib/webshop/actions'
import {
  KEY_SPEC_PRESETS,
  MAX_KEY_SPECS,
  resolveCategoryTemplate,
  sortTemplate
} from '@/lib/webshop/key-specs'
import type {
  CategoryAttributeRole,
  ProductAttributeRow,
  WebCategoryRow
} from '@/lib/webshop/types'

type Item = { attributeId: string; role: CategoryAttributeRole }

type Props = {
  category: WebCategoryRow | null
  categories: WebCategoryRow[]
  attributes: ProductAttributeRow[]
  onClose: () => void
}

const ROLE_OPTIONS = [
  { value: 'key', label: 'Kulcsadat' },
  { value: 'spec', label: 'Ajánlott adat' }
]

export function CategoryKeySpecsDialog({
  category,
  categories,
  attributes,
  onClose
}: Props) {
  if (!category) return null
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-xl">
        <Body
          key={category.id}
          category={category}
          categories={categories}
          attributes={attributes}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

function Body({
  category,
  categories,
  attributes,
  onClose
}: Props & { category: WebCategoryRow }) {
  const [pending, startTransition] = useTransition()
  const [items, setItems] = useState<Item[]>(() =>
    sortTemplate(category.template).map((t) => ({
      attributeId: t.attributeId,
      role: t.role
    }))
  )
  const [measureImageUrl, setMeasureImageUrl] = useState(category.measureImageUrl ?? '')
  const [addId, setAddId] = useState('')

  const attrById = useMemo(
    () => new Map(attributes.map((a) => [a.id, a])),
    [attributes]
  )

  const inherited = useMemo(() => {
    if (category.template.length > 0 || !category.parentId) return null
    const r = resolveCategoryTemplate(categories, category.parentId)
    return r.items.length > 0 ? r : null
  }, [categories, category])

  const keyCount = items.filter((i) => i.role === 'key').length
  const addOptions = attributes
    .filter((a) => a.active && !items.some((i) => i.attributeId === a.id))
    .map((a) => ({ value: a.id, label: a.name }))

  function move(index: number, dir: -1 | 1) {
    const next = [...items]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }

  function add(id: string) {
    if (!id) return
    setItems((prev) => [
      ...prev,
      { attributeId: id, role: keyCount < MAX_KEY_SPECS ? 'key' : 'spec' }
    ])
    setAddId('')
  }

  function save() {
    startTransition(async () => {
      const ordered = [
        ...items.filter((i) => i.role === 'key'),
        ...items.filter((i) => i.role === 'spec')
      ]
      const result = await saveCategoryTemplate({
        categoryId: category.id,
        items: ordered,
        measureImageUrl
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Kulcsadatok mentve.')
      onClose()
      window.location.reload()
    })
  }

  function applyPreset(presetId: string) {
    startTransition(async () => {
      const result = await applyKeySpecPreset({ categoryId: category.id, presetId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success('Sablon hozzáadva — a hiányzó jellemzőket létrehoztuk.')
      onClose()
      window.location.reload()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Kulcsadatok · {category.name}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <p className="text-hint text-ink-secondary">
          A kulcsadatok (legfeljebb {MAX_KEY_SPECS}) a termékoldal „Kulcsadatok”
          blokkjában jelennek meg — ezek alapján dönti el a vásárló, hogy neki való-e.
          Az első a fő adat: ez a variánsváltó címkéje is, ha a család tagjai ebben
          térnek el.
        </p>

        {inherited && items.length === 0 ? (
          <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink">
            Most örökli: <strong>{inherited.sourceCategoryName}</strong> ·{' '}
            {inherited.items
              .map((i) => attrById.get(i.attributeId)?.name)
              .filter(Boolean)
              .join(', ')}
            . Ha itt felveszel adatot, az felülírja az örököltet.
          </p>
        ) : null}

        {items.length > 0 ? (
          <ol className="space-y-1.5">
            {items.map((item, index) => {
              const attr = attrById.get(item.attributeId)
              const overLimit =
                item.role === 'key' &&
                items.filter((i, j) => i.role === 'key' && j <= index).length >
                  MAX_KEY_SPECS
              return (
                <li
                  key={item.attributeId}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2"
                >
                  <span className="min-w-0 flex-1 text-body font-medium text-ink">
                    {attr?.name ?? 'Törölt adat'}
                    {attr?.unit ? (
                      <span className="text-ink-secondary"> · {attr.unit}</span>
                    ) : null}
                    {index === 0 && item.role === 'key' ? (
                      <span className="ml-1.5 text-hint text-ink-secondary">(fő adat)</span>
                    ) : null}
                    {overLimit ? (
                      <span className="block text-hint text-danger-ink">
                        Legfeljebb {MAX_KEY_SPECS} kulcsadat — állítsd „Ajánlott”-ra.
                      </span>
                    ) : null}
                  </span>
                  <div className="w-44">
                    <MenuSelect
                      id={`tpl-role-${item.attributeId}`}
                      value={item.role}
                      options={ROLE_OPTIONS}
                      onChange={(v) =>
                        setItems((prev) =>
                          prev.map((p, j) =>
                            j === index
                              ? { ...p, role: (v === 'spec' ? 'spec' : 'key') as CategoryAttributeRole }
                              : p
                          )
                        )
                      }
                      disabled={pending}
                    />
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${attr?.name ?? 'Adat'} feljebb`}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${attr?.name ?? 'Adat'} lejjebb`}
                      disabled={pending || index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger-ink"
                      aria-label={`${attr?.name ?? 'Adat'} eltávolítása`}
                      disabled={pending}
                      onClick={() =>
                        setItems((prev) => prev.filter((_, j) => j !== index))
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : null}

        <FormField
          label="Adat hozzáadása"
          htmlFor="tpl-add"
          optionalLabel
          hint={
            addOptions.length === 0
              ? 'Nincs több jellemző — a Jellemzők oldalon vehetsz fel újat.'
              : undefined
          }
        >
          <MenuSelect
            id="tpl-add"
            value={addId}
            allowEmpty
            searchable
            placeholder="Válassz jellemzőt…"
            options={addOptions}
            onChange={add}
            disabled={pending || addOptions.length === 0}
          />
        </FormField>

        {items.length === 0 ? (
          <div className="space-y-1.5">
            <p className="text-label font-semibold text-ink">Vagy indulj sablonból</p>
            <div className="flex flex-wrap gap-1.5">
              {KEY_SPEC_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => applyPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <p className="text-hint text-ink-secondary">
              A hiányzó jellemzőket létrehozza, a meglévő kódúakat újrahasználja.
              Utána szabadon átírhatod.
            </p>
          </div>
        ) : null}

        <FormField
          label="Mérési ábra URL"
          htmlFor="tpl-img"
          optionalLabel
          hint="„Hogyan mérd le?” rajz a kategória minden termékére. A termék saját méretrajza felülírja."
        >
          <Input
            id="tpl-img"
            value={measureImageUrl}
            onChange={(e) => setMeasureImageUrl(e.target.value)}
            maxLength={2000}
            placeholder="https://…"
            disabled={pending}
          />
        </FormField>
      </div>

      <DialogFooter>
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
          Mégse
        </Button>
        <Button type="button" loading={pending} onClick={save}>
          Kulcsadatok mentése
        </Button>
      </DialogFooter>
    </>
  )
}
