'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
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
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import {
  createWebCategory,
  softDeleteWebCategory,
  updateWebCategory
} from '@/lib/webshop/actions'
import {
  googleTaxonomyMenuOptions,
  suggestTaxonomyIdFromCategoryName,
  taxonomyOptionById
} from '@/lib/webshop/google-taxonomy'
import { CategoryKeySpecsDialog } from '@/components/webshop/category-key-specs-dialog'
import { resolveCategoryTemplate } from '@/lib/webshop/key-specs'
import type { ProductAttributeRow, WebCategoryRow } from '@/lib/webshop/types'

type Props = {
  initialRows: WebCategoryRow[]
  attributes: ProductAttributeRow[]
  canWrite: boolean
}

type Editor =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; row: WebCategoryRow }

export function WebshopCategoriesClient({
  initialRows,
  attributes,
  canWrite
}: Props) {
  const [search, setSearch] = useState('')
  const [specsTarget, setSpecsTarget] = useState<WebCategoryRow | null>(null)
  const attrName = useMemo(
    () => new Map(attributes.map((a) => [a.id, a.name])),
    [attributes]
  )

  function keySpecSummary(row: WebCategoryRow): { text: string; inherited: boolean } {
    const r = resolveCategoryTemplate(initialRows, row.id)
    const names = r.items
      .filter((i) => i.role === 'key')
      .map((i) => attrName.get(i.attributeId))
      .filter(Boolean)
    if (names.length === 0) return { text: '—', inherited: false }
    return { text: names.join(', '), inherited: r.inherited }
  }
  const [editor, setEditor] = useState<Editor>({ mode: 'closed' })
  const [deleteTarget, setDeleteTarget] = useState<WebCategoryRow | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [googleTaxonomyId, setGoogleTaxonomyId] = useState('')
  const [sortOrder, setSortOrder] = useState('100')
  const [active, setActive] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return initialRows
    return initialRows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.parentName ?? '').toLowerCase().includes(term)
    )
  }, [initialRows, search])

  function openCreate() {
    setName('')
    setParentId('')
    setGoogleTaxonomyId('')
    setSortOrder('100')
    setActive(true)
    setFieldErrors({})
    setEditor({ mode: 'create' })
  }

  function openEdit(row: WebCategoryRow) {
    setName(row.name)
    setParentId(row.parentId ?? '')
    setGoogleTaxonomyId(row.googleTaxonomyId ?? '')
    setSortOrder(String(row.sortOrder))
    setActive(row.active)
    setFieldErrors({})
    setEditor({ mode: 'edit', row })
  }

  function onNameChange(next: string) {
    setName(next)
    if (googleTaxonomyId.trim()) return
    const suggested = suggestTaxonomyIdFromCategoryName(next)
    if (suggested) setGoogleTaxonomyId(suggested)
  }

  function onParentChange(next: string) {
    setParentId(next)
    if (googleTaxonomyId.trim()) return
    const parent = initialRows.find((r) => r.id === next)
    if (parent?.googleTaxonomyId) {
      setGoogleTaxonomyId(parent.googleTaxonomyId)
      return
    }
    const suggested = suggestTaxonomyIdFromCategoryName(name)
    if (suggested) setGoogleTaxonomyId(suggested)
  }

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const sort = Number(sortOrder)
      const payload = {
        name,
        parentId: parentId || null,
        googleTaxonomyId,
        sortOrder: Number.isFinite(sort) ? sort : 100,
        active
      }
      const result =
        editor.mode === 'edit'
          ? await updateWebCategory({ ...payload, id: editor.row.id })
          : await createWebCategory(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success(editor.mode === 'edit' ? 'Kategória mentve.' : 'Kategória létrehozva.')
      setEditor({ mode: 'closed' })
      window.location.reload()
    })
  }

  const parentOptions = initialRows
    .filter((r) => editor.mode !== 'edit' || r.id !== editor.row.id)
    .map((r) => ({
      value: r.id,
      label: r.parentName ? `${r.parentName} › ${r.name}` : r.name
    }))

  const taxonomyOptions = useMemo(() => googleTaxonomyMenuOptions(), [])
  const selectedTaxonomy = taxonomyOptionById(googleTaxonomyId)

  return (
    <div>
      <PageHeader
        title="Bolt kategóriák"
        description="Ezekből választasz a terméken — nem szabad szöveg."
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Új kategória
            </Button>
          ) : null
        }
      />

      <div className="mb-3">
        <form onSubmit={(e) => e.preventDefault()} className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés…"
            className="pl-8"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-subtle px-4 py-8 text-center text-body text-ink-secondary">
          Még nincs kategória. Az add-on bekapcsolásakor seed kerülhet be.
        </p>
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Név</DataTableHeaderCell>
              <DataTableHeaderCell>Szülő</DataTableHeaderCell>
              <DataTableHeaderCell>Kulcsadatok</DataTableHeaderCell>
              <DataTableHeaderCell>Google</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                Termék
              </DataTableHeaderCell>
              <DataTableHeaderCell>Állapot</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">
                {canWrite ? 'Műveletek' : null}
              </DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell className="font-medium">{row.name}</DataTableCell>
                <DataTableCell className="text-ink-secondary">
                  {row.parentName ?? '—'}
                </DataTableCell>
                <DataTableCell className="max-w-[260px] text-ink-secondary">
                  {(() => {
                    const s = keySpecSummary(row)
                    return (
                      <span className="line-clamp-2">
                        {s.text}
                        {s.inherited ? (
                          <span className="text-ink-muted"> (örökölt)</span>
                        ) : null}
                      </span>
                    )
                  })()}
                </DataTableCell>
                <DataTableCell className="text-ink-secondary tabular-nums">
                  {row.googleTaxonomyId
                    ? taxonomyOptionById(row.googleTaxonomyId)?.hintHu ??
                      row.googleTaxonomyId
                    : '—'}
                </DataTableCell>
                <DataTableCell className="text-right tabular-nums">
                  {row.productCount}
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={row.active ? 'success' : 'neutral'}>
                    {row.active ? 'Aktív' : 'Inaktív'}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="text-right">
                  {canWrite ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSpecsTarget(row)}
                      >
                        Kulcsadatok
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        Szerkeszt
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Törlés
                      </Button>
                    </div>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}

      <Dialog
        open={editor.mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) setEditor({ mode: 'closed' })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor.mode === 'edit' ? 'Kategória szerkesztése' : 'Új kategória'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <FormField label="Név" htmlFor="cat-name" required error={fieldErrors.name}>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                disabled={pending}
              />
            </FormField>
            <FormField label="Szülő" htmlFor="cat-parent" optionalLabel>
              <MenuSelect
                id="cat-parent"
                value={parentId}
                allowEmpty
                placeholder="Nincs (fő kategória)"
                options={parentOptions}
                onChange={onParentChange}
                disabled={pending}
              />
            </FormField>
            <FormField
              label="Google kategória"
              htmlFor="cat-google"
              optionalLabel
              hint={
                selectedTaxonomy
                  ? selectedTaxonomy.path
                  : 'Üresen a név vagy a szülő alapján töltjük (Merchant ID)'
              }
            >
              <MenuSelect
                id="cat-google"
                value={googleTaxonomyId}
                allowEmpty
                searchable
                searchPlaceholder="Keresés (pl. zsanér, fogantyú)…"
                placeholder="Automatikus / válassz…"
                options={taxonomyOptions}
                onChange={setGoogleTaxonomyId}
                disabled={pending}
              />
            </FormField>
            <FormField label="Sorrend" htmlFor="cat-sort" optionalLabel>
              <Input
                id="cat-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                inputMode="numeric"
                disabled={pending}
              />
            </FormField>
            <Switch
              id="cat-active"
              checked={active}
              onCheckedChange={setActive}
              disabled={pending}
              label="Aktív"
            />
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
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoryKeySpecsDialog
        category={specsTarget}
        categories={initialRows}
        attributes={attributes}
        onClose={() => setSpecsTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Kategória törlése"
        description={
          deleteTarget
            ? `Törlöd a(z) „${deleteTarget.name}” kategóriát?`
            : ''
        }
        confirmLabel="Törlés"
        loading={pending}
        onConfirm={() => {
          if (!deleteTarget) return
          startTransition(async () => {
            const result = await softDeleteWebCategory(deleteTarget.id)
            if (!result.ok) {
              toast.error(result.message)
              return
            }
            toast.success('Kategória törölve.')
            setDeleteTarget(null)
            window.location.reload()
          })
        }}
      />
    </div>
  )
}
