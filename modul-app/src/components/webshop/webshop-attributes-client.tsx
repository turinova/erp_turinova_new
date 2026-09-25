'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
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
import { Switch } from '@/components/ui/switch'
import {
  createAttributeValue,
  createProductAttribute,
  softDeleteAttributeValue,
  softDeleteProductAttribute,
  updateProductAttribute
} from '@/lib/webshop/actions'
import { UNIT_OPTIONS, VALUE_TYPE_LABEL } from '@/lib/webshop/key-specs'
import type {
  AttributeValueType,
  ProductAttributeRow
} from '@/lib/webshop/types'

type Props = {
  initialRows: ProductAttributeRow[]
  canWrite: boolean
}

type Editor =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: ProductAttributeRow }

const TYPE_OPTIONS = (Object.keys(VALUE_TYPE_LABEL) as AttributeValueType[]).map(
  (t) => ({ value: t, label: VALUE_TYPE_LABEL[t] })
)

const UNIT_MENU = UNIT_OPTIONS.map((u) => ({ value: u, label: u }))

function typeSummary(attr: ProductAttributeRow): string {
  const base =
    attr.valueType === 'list'
      ? attr.allowMultiple
        ? 'Lista, több is választható'
        : 'Lista'
      : attr.valueType === 'number'
        ? 'Szám'
        : attr.valueType === 'range'
          ? 'Tartomány'
          : 'Igen / nem'
  return attr.unit ? `${base} · ${attr.unit}` : base
}

export function WebshopAttributesClient({ initialRows, canWrite }: Props) {
  const [pending, startTransition] = useTransition()
  const [editor, setEditor] = useState<Editor>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<ProductAttributeRow | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [valueType, setValueType] = useState<AttributeValueType>('list')
  const [unit, setUnit] = useState('')
  const [measureHint, setMeasureHint] = useState('')
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({})

  function openCreate() {
    setName('')
    setCode('')
    setValueType('list')
    setUnit('')
    setMeasureHint('')
    setAllowMultiple(false)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: ProductAttributeRow) {
    setName(row.name)
    setCode(row.code)
    setValueType(row.valueType)
    setUnit(row.unit ?? '')
    setMeasureHint(row.measureHint ?? '')
    setAllowMultiple(row.allowMultiple)
    setFieldErrors({})
    setEditor({ mode: 'edit', row })
  }

  function handleSave() {
    startTransition(async () => {
      const common = {
        name,
        valueType,
        unit: unit || null,
        measureHint,
        allowMultiple
      }
      const result =
        editor.mode === 'edit'
          ? await updateProductAttribute({ ...common, id: editor.row.id })
          : await createProductAttribute({ ...common, code })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success(editor.mode === 'edit' ? 'Jellemző mentve.' : 'Jellemző létrehozva.')
      setEditor({ mode: 'closed' })
      window.location.reload()
    })
  }

  const typeLocked = editor.mode === 'edit' && editor.row.inUse
  const needsUnit = valueType === 'number' || valueType === 'range'

  return (
    <div>
      <PageHeader
        title="Jellemzők"
        description="A terméken ezeket töltöd ki. Szám / tartomány típusnál rögzített mértékegység van (pl. mm). A kategóriánál választod ki, melyik a kulcsadat a „Passzol-e?” blokkba."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új adat
            </Button>
          ) : null
        }
      />

      <div className="space-y-3">
        {initialRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
            Még nincs jellemző. Hozz létre egyet (pl. Furattávolság, mm), vagy a
            Bolt kategóriáknál adj hozzá egy sablont.
          </p>
        ) : null}

        {initialRows.map((attr) => (
          <section
            key={attr.id}
            className="rounded-md border border-border bg-surface p-3.5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-h3 text-ink">{attr.name}</h2>
                <StatusBadge tone="neutral" variant="outline">
                  {attr.code}
                </StatusBadge>
                <span className="text-hint text-ink-secondary">{typeSummary(attr)}</span>
              </div>
              {canWrite ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => openEdit(attr)}
                  >
                    Szerkeszt
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger-ink"
                    disabled={pending}
                    onClick={() => setDeleteTarget(attr)}
                  >
                    Törlés
                  </Button>
                </div>
              ) : null}
            </div>

            {attr.measureHint ? (
              <p className="mb-2 text-hint text-ink-secondary">
                Hogyan mérd le: {attr.measureHint}
              </p>
            ) : null}

            {attr.valueType === 'list' ? (
              <>
                <ul className="mb-2 flex flex-wrap gap-1.5">
                  {attr.values
                    .filter((v) => v.active)
                    .map((v) => (
                      <li key={v.id}>
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-subtle px-1.5 py-0.5 text-hint text-ink">
                          {v.label}
                          {canWrite ? (
                            <button
                              type="button"
                              className="text-ink-muted hover:text-danger-ink"
                              aria-label={`${v.label} törlése`}
                              disabled={pending}
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await softDeleteAttributeValue(v.id)
                                  if (!result.ok) {
                                    toast.error(result.message)
                                    return
                                  }
                                  toast.success('Érték törölve.')
                                  window.location.reload()
                                })
                              }}
                            >
                              <Trash2 className="size-3" aria-hidden />
                            </button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  {attr.values.filter((v) => v.active).length === 0 ? (
                    <li className="text-hint text-ink-secondary">Még nincs érték.</li>
                  ) : null}
                </ul>

                {canWrite ? (
                  <div className="flex max-w-md gap-1.5">
                    <Input
                      value={valueDrafts[attr.id] ?? ''}
                      onChange={(e) =>
                        setValueDrafts((prev) => ({
                          ...prev,
                          [attr.id]: e.target.value
                        }))
                      }
                      placeholder="Új érték…"
                      aria-label={`Új érték: ${attr.name}`}
                      disabled={pending}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        const label = (valueDrafts[attr.id] ?? '').trim()
                        if (!label) {
                          toast.error('Adj meg egy értéket.')
                          return
                        }
                        startTransition(async () => {
                          const result = await createAttributeValue({
                            attributeId: attr.id,
                            label
                          })
                          if (!result.ok) {
                            toast.error(result.message)
                            return
                          }
                          toast.success('Érték hozzáadva.')
                          setValueDrafts((prev) => ({ ...prev, [attr.id]: '' }))
                          window.location.reload()
                        })
                      }}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Érték hozzáadása
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-hint text-ink-secondary">
                Az értéket a terméken írod be
                {attr.unit ? ` (${attr.unit})` : ''}.
              </p>
            )}
          </section>
        ))}
      </div>

      <Dialog
        open={editor.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setEditor({ mode: 'closed' })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit' ? 'Jellemző szerkesztése' : 'Új jellemző'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <FormField label="Név" htmlFor="attr-name" required error={fieldErrors.name}>
              <Input
                id="attr-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Furattávolság"
                disabled={pending}
              />
            </FormField>
            {editor.mode === 'create' ? (
              <FormField
                label="Kód"
                htmlFor="attr-code"
                required
                error={fieldErrors.code}
                hint="Angol betű — color / size / material = Google feed mező. Később nem módosítható."
              >
                <Input
                  id="attr-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="hole_spacing"
                  disabled={pending}
                />
              </FormField>
            ) : null}
            <FormField
              label="Érték típusa"
              htmlFor="attr-type"
              required
              error={fieldErrors.valueType}
              hint={
                typeLocked
                  ? 'Már van terméken érték — a típus nem váltható.'
                  : 'Méretnél „Szám” vagy „Tartomány”, színnél „Lista”.'
              }
            >
              <MenuSelect
                id="attr-type"
                value={valueType}
                options={TYPE_OPTIONS}
                onChange={(v) => setValueType((v || 'list') as AttributeValueType)}
                disabled={pending || typeLocked}
              />
            </FormField>
            {needsUnit ? (
              <FormField
                label="Mértékegység"
                htmlFor="attr-unit"
                optionalLabel
                hint="Egy adat = egy egység, nincs átváltás"
              >
                <MenuSelect
                  id="attr-unit"
                  value={unit}
                  allowEmpty
                  placeholder="Nincs"
                  options={UNIT_MENU}
                  onChange={setUnit}
                  disabled={pending}
                />
              </FormField>
            ) : null}
            {valueType === 'list' ? (
              <Switch
                id="attr-multi"
                checked={allowMultiple}
                onCheckedChange={setAllowMultiple}
                disabled={pending}
                label="Több érték is választható"
                description="Pl. kombi furatú fogantyú, több ráütéshez jó zsanér"
              />
            ) : null}
            <FormField
              label="Hogyan mérd le?"
              htmlFor="attr-hint"
              optionalLabel
              hint="Egy mondat a vásárlónak — a „Passzol-e?” kártya alatt jelenik meg"
            >
              <Input
                id="attr-hint"
                value={measureHint}
                onChange={(e) => setMeasureHint(e.target.value)}
                maxLength={300}
                placeholder="pl. A két csavarfurat közepe közötti távolság."
                disabled={pending}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditor({ mode: 'closed' })}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              {editor.mode === 'edit' ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Jellemző törlése"
        description={
          deleteTarget
            ? `Törlöd a(z) „${deleteTarget.name}” adatot? A termékekről és a kategória-sablonokból is eltűnik.`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={() => {
          if (!deleteTarget) return
          startTransition(async () => {
            const result = await softDeleteProductAttribute(deleteTarget.id)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success('Jellemző törölve.')
            setDeleteTarget(null)
            window.location.reload()
          })
        }}
      />
    </div>
  )
}
