'use client'

import { Link2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AccessoryDocumentsSection } from '@/components/accessories/accessory-documents-section'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { suggestWebSlug } from '@/lib/accessories/web-shop'
import { searchVariantCandidates, type VariantCandidate } from '@/lib/webshop/product-actions'

import type { GroupProps } from './groups-content'
import { ListEditor } from './list-editor'

export function MediaGroup({
  web,
  patch,
  disabled,
  fieldErrors,
  images,
  alts,
  onAltsChange,
  accessoryId,
  tenantId
}: GroupProps & {
  images: string[]
  alts: Record<string, string>
  onAltsChange: (next: Record<string, string>) => void
  accessoryId: string
  tenantId: string
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-label font-semibold text-ink">Mi látszik a képen</p>
        <p className="text-hint text-ink-secondary">
          Egy rövid mondat képenként — látássérült vásárlóknak és a keresőknek. A képeket az
          alapadatoknál tudod cserélni.
        </p>
        {images.length === 0 ? (
          <p className="text-hint text-ink-secondary">Még nincs kép a terméken.</p>
        ) : (
          <ul className="space-y-1.5">
            {images.map((url, index) => (
              <li key={url} className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="size-10 shrink-0 rounded border border-border bg-surface object-cover"
                />
                <Input
                  aria-label={index === 0 ? 'Fő kép leírása' : `${index + 1}. kép leírása`}
                  value={alts[url] ?? ''}
                  maxLength={200}
                  disabled={disabled}
                  placeholder={index === 0 ? 'Pl. Fehér zsanér nyitott állapotban' : undefined}
                  onChange={(e) => onAltsChange({ ...alts, [url]: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormField
        label="Videó"
        htmlFor="shop-video"
        optionalLabel
        error={fieldErrors.webVideoUrl}
        hint="YouTube link. A termékoldalon csak kattintásra töltődik be."
      >
        <Input
          id="shop-video"
          value={web.videoUrl}
          onChange={(e) => patch({ videoUrl: e.target.value })}
          maxLength={2000}
          inputMode="url"
          disabled={disabled}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </FormField>

      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="text-label font-semibold text-ink">Dokumentumok</p>
        <AccessoryDocumentsSection
          accessoryId={accessoryId}
          tenantId={tenantId}
          disabled={disabled}
          embedded
        />
      </div>
    </div>
  )
}

export function VariantsGroup({
  web,
  patch,
  disabled,
  accessoryId
}: GroupProps & { accessoryId: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<VariantCandidate[]>([])
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      const r = await searchVariantCandidates(accessoryId, term)
      if (alive && r.ok) setResults(r.items)
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, accessoryId])

  function join(c: VariantCandidate) {
    if (c.group_id) {
      patch({ webGroupId: c.group_id })
      setNote(null)
    } else {
      const id = (c.slug || suggestWebSlug(c.name)).slice(0, 64)
      patch({ webGroupId: id })
      setNote(`Mentés után a(z) „${c.name}” bolt adatainál is add meg ezt a csoportot: ${id}`)
    }
    setQ('')
    setResults([])
  }

  return (
    <div className="space-y-2.5">
      <p className="text-hint text-ink-secondary">
        Ugyanaz a termék más színben, méretben vagy kiszerelésben. Az egy csoportba tartozó termékek
        között a vásárló a termékoldalon válthat.
      </p>
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        <FormField label="Keress rá a testvér termékre" htmlFor="shop-variant-search" optionalLabel>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <Input
              id="shop-variant-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Név vagy cikkszám"
              disabled={disabled}
              autoComplete="off"
              className="pl-8"
            />
          </div>
        </FormField>
        <FormField
          label="Változatcsoport"
          htmlFor="shop-group"
          optionalLabel
          hint="Az azonos csoportnevű termékek egy család."
        >
          <Input
            id="shop-group"
            value={web.webGroupId}
            onChange={(e) => patch({ webGroupId: e.target.value })}
            maxLength={64}
            disabled={disabled}
          />
        </FormField>
      </div>
      {results.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-2 py-1.5">
              <span className="size-8 shrink-0 overflow-hidden rounded border border-border bg-surface">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="size-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{r.name}</span>
                <span className="text-hint text-ink-secondary">
                  {r.sku}
                  {r.group_id ? ` · csoport: ${r.group_id}` : ' · még nincs csoportja'}
                </span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => join(r)}
              >
                <Link2 className="size-3.5" aria-hidden />
                {r.group_id ? 'Csatlakozás a csoportjához' : 'Új csoport vele'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary" role="status">
          {note}
        </p>
      ) : null}
    </div>
  )
}

export function AdvancedGroup({
  web,
  patch,
  disabled,
  fieldErrors,
  productName,
  manufacturerName
}: GroupProps & { productName: string; manufacturerName: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-hint text-ink-secondary">
        Ezeket a rendszer kitölti magától. Csak akkor írd át, ha tudod, mit csinálsz.
      </p>
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        <FormField
          label="Webcím"
          htmlFor="shop-slug"
          optionalLabel
          error={fieldErrors.webSlug}
          hint={`A termékoldal címe: /p/${web.webSlug || suggestWebSlug(productName) || '…'}`}
        >
          <Input
            id="shop-slug"
            value={web.webSlug}
            onChange={(e) => patch({ webSlug: e.target.value.toLowerCase() })}
            maxLength={120}
            disabled={disabled}
            placeholder={suggestWebSlug(productName)}
            autoComplete="off"
          />
        </FormField>
        <FormField
          label="Cím a boltban"
          htmlFor="shop-title"
          optionalLabel
          error={fieldErrors.webTitle}
          hint="Ha üres, a termék neve látszik."
        >
          <Input
            id="shop-title"
            value={web.webTitle}
            onChange={(e) => patch({ webTitle: e.target.value })}
            maxLength={150}
            disabled={disabled}
            placeholder={productName}
          />
        </FormField>
        <FormField label="Márka" htmlFor="shop-brand" optionalLabel hint="Ha üres, a gyártó neve.">
          <Input
            id="shop-brand"
            value={web.webBrand}
            onChange={(e) => patch({ webBrand: e.target.value })}
            maxLength={120}
            disabled={disabled}
            placeholder={manufacturerName ?? undefined}
          />
        </FormField>
        <FormField
          label="Gyártói cikkszám"
          htmlFor="shop-mpn"
          optionalLabel
          hint="A gyártó saját kódja. Akkor fontos, ha nincs vonalkód."
        >
          <Input
            id="shop-mpn"
            value={web.webMpn}
            onChange={(e) => patch({ webMpn: e.target.value })}
            maxLength={64}
            disabled={disabled}
          />
        </FormField>
        <FormField
          label="Google kategória"
          htmlFor="shop-google-category"
          optionalLabel
          hint="A bolt kategóriájából jön. Szám vagy útvonal a Google listájából."
        >
          <Input
            id="shop-google-category"
            value={web.webGoogleCategory}
            onChange={(e) => patch({ webGoogleCategory: e.target.value })}
            maxLength={240}
            disabled={disabled}
          />
        </FormField>
        <FormField
          label="Más szavak, amikkel keresik"
          htmlFor="shop-aliases"
          optionalLabel
          hint="Pl. becenév, elírás, régi név. Egy sor = egy szó."
        >
          <ListEditor
            id="shop-aliases"
            value={web.webSearchAliasesRaw}
            onChange={(v) => patch({ webSearchAliasesRaw: v })}
            disabled={disabled}
            addLabel="Új keresőszó"
          />
        </FormField>
      </div>
      <Switch
        id="shop-no-identifier"
        checked={!web.identifierExists}
        disabled={disabled}
        onCheckedChange={(v) => patch({ identifierExists: !v })}
        label="Nincs vonalkódja és gyártói cikkszáma"
        description="Saját gyártású vagy egyedi termék. Így a Google és a ChatGPT nem hiányolja az azonosítót."
      />
    </div>
  )
}
