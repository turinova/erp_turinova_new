'use client'

import { Plus, Trash2 } from 'lucide-react'

import { AccessorySpecField, EMPTY_SPEC_DRAFT } from '@/components/accessories/accessory-spec-field'
import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import { suggestWebDescriptionShort } from '@/lib/accessories/web-shop'
import { SHOP_DESCRIPTION_MIN } from '@/lib/webshop/product-parse'
import type { ProductAttributeRow, WebCategoryRow } from '@/lib/webshop/types'

import {
  merchantFieldsFromAttributes,
  selectedValuesForAttr,
  type AccessoryWebFormState,
  type specModel
} from './form-state'
import { ListEditor } from './list-editor'

export type GroupProps = {
  web: AccessoryWebFormState
  patch: (partial: Partial<AccessoryWebFormState>) => void
  disabled: boolean
  fieldErrors: Record<string, string>
}

const FAQ_MAX = 5

export function BasicsGroup({
  web,
  patch,
  disabled,
  fieldErrors,
  categories
}: GroupProps & { categories: WebCategoryRow[] }) {
  const length = web.webDescriptionLong.trim().length
  const left = SHOP_DESCRIPTION_MIN - length

  function onCategoryChange(id: string) {
    const cat = categories.find((c) => c.id === id)
    const path = cat ? (cat.parentName ? `${cat.parentName} > ${cat.name}` : cat.name) : ''
    patch({
      webCategoryId: id,
      webProductType: path,
      webGoogleCategory: cat?.googleTaxonomyId || web.webGoogleCategory
    })
  }

  return (
    <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
      <FormField
        label="Hol legyen a boltban"
        htmlFor="shop-category"
        required
        error={fieldErrors.webCategoryId}
        hint="Ebből jön a Google kategória és a kulcsadatok listája is."
      >
        <MenuSelect
          id="shop-category"
          value={web.webCategoryId}
          onChange={onCategoryChange}
          disabled={disabled}
          placeholder="Válassz kategóriát"
          searchable
          searchPlaceholder="Kategória keresése"
          options={categories
            .filter((c) => c.active)
            .map((c) => ({
              value: c.id,
              label: c.parentName ? `${c.parentName} › ${c.name}` : c.name
            }))}
        />
      </FormField>
      <div className="hidden sm:block" />
      <FormField
        label="Leírás a vásárlónak"
        htmlFor="shop-description"
        required
        error={fieldErrors.webDescriptionLong}
        hint={
          left > 0
            ? `${length} karakter — még legalább ${left} kell. Írd le, mire való és miben jó.`
            : `${length} karakter. Az első mondatokból lesz a rövid szöveg a listában.`
        }
        className="sm:col-span-2"
      >
        <Textarea
          id="shop-description"
          value={web.webDescriptionLong}
          onChange={(e) =>
            patch({
              webDescriptionLong: e.target.value,
              webDescriptionShort: suggestWebDescriptionShort(e.target.value)
            })
          }
          rows={7}
          maxLength={5000}
          disabled={disabled}
          placeholder="Pl. Fehér bútorzsanér konyhaszekrény-ajtókhoz. Acél, csendesen záródik, 110°-ban nyílik."
        />
      </FormField>
    </div>
  )
}

export function SpecsGroup({
  web,
  patch,
  disabled,
  fieldErrors,
  attributes,
  model,
  productName
}: GroupProps & {
  attributes: ProductAttributeRow[]
  model: ReturnType<typeof specModel>
  productName: string
}) {
  const { template, keyAttrs, specAttrs, otherAttrs, keyFilled } = model

  function setAttrValues(attributeId: string, valueIds: string[]) {
    const attr = attributes.find((a) => a.id === attributeId)
    if (!attr) return
    const own = new Set(attr.values.map((v) => v.id))
    const next = [
      ...web.attributeValueIds.filter((id) => !own.has(id)),
      ...valueIds.filter((id) => own.has(id))
    ]
    patch({
      attributeValueIds: next,
      ...merchantFieldsFromAttributes(attributes, next, {
        webColor: web.webColor,
        webSize: web.webSize,
        webMaterial: web.webMaterial
      })
    })
  }

  function field(attr: ProductAttributeRow, primary = false) {
    return (
      <AccessorySpecField
        key={attr.id}
        attr={attr}
        draft={web.specInputs[attr.id] ?? EMPTY_SPEC_DRAFT}
        selectedValueIds={selectedValuesForAttr(web, attr)}
        onDraftChange={(d) => patch({ specInputs: { ...web.specInputs, [attr.id]: d } })}
        onValuesChange={(ids) => setAttrValues(attr.id, ids)}
        disabled={disabled}
        error={fieldErrors[`spec-${attr.id}`]}
        productName={primary ? productName : undefined}
        emphasis={attr.valueType === 'list' && attr.allowMultiple}
      />
    )
  }

  if (!web.webCategoryId) {
    return (
      <p className="text-hint text-ink-secondary">
        Előbb válaszd ki az „Alapok” résznél, hol legyen a boltban — a kategória mondja meg, milyen
        adatokat érdemes itt megadni.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {keyAttrs.length > 0 ? (
        <div className="space-y-2">
          <div>
            <p className="text-label font-semibold text-ink">
              Kulcsadatok{' '}
              <span className="font-normal text-ink-secondary">
                ({keyFilled}/{keyAttrs.length} kitöltve)
              </span>
            </p>
            <p className="text-hint text-ink-secondary">
              Ezek alapján dönti el a vásárló, hogy ez kell-e neki. Ami üres, az nem jelenik meg.
              {template.inherited && template.sourceCategoryName
                ? ` A lista a(z) ${template.sourceCategoryName} kategóriából jön.`
                : ''}
            </p>
          </div>
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {keyAttrs.map((a, i) => field(a, i === 0))}
          </div>
        </div>
      ) : (
        <p className="text-hint text-ink-secondary">
          Ennek a kategóriának még nincs kulcsadata. A Webshop → Bolt kategóriák oldalon adhatod meg
          (pl. méret, űrtartalom, teljesítmény).
        </p>
      )}

      {specAttrs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-label font-semibold text-ink">Ajánlott adatok</p>
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            {specAttrs.map((a) => field(a))}
          </div>
        </div>
      ) : null}

      {otherAttrs.length > 0 ? (
        <details className="rounded-md border border-border">
          <summary className="cursor-pointer px-2.5 py-2 text-label font-semibold text-ink">
            További jellemzők ({otherAttrs.length})
          </summary>
          <div className="grid gap-x-3 gap-y-2.5 border-t border-border p-2.5 sm:grid-cols-2">
            {otherAttrs.map((a) => field(a))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

export function QuestionsGroup({ web, patch, disabled }: GroupProps) {
  const faq = web.faqItems.length > 0 ? web.faqItems : [{ q: '', a: '' }]
  const setFaq = (next: typeof faq) => patch({ faqItems: next })

  return (
    <div className="space-y-3">
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        <FormField
          label="Mire jó"
          htmlFor="shop-use-cases"
          optionalLabel
          hint="Egy sor = egy előny. Pl. „Konyhaszekrény ajtajára”."
        >
          <ListEditor
            id="shop-use-cases"
            value={web.useCasesRaw}
            onChange={(v) => patch({ useCasesRaw: v })}
            disabled={disabled}
            addLabel="Új előny"
            placeholder="Konyhaszekrény ajtajára"
          />
        </FormField>
        <FormField
          label="Mihez illik"
          htmlFor="shop-compat"
          optionalLabel
          hint="Milyen géphez, bútorhoz, típushoz passzol. Egy sor = egy típus."
        >
          <ListEditor
            id="shop-compat"
            value={web.compatibilityRaw}
            onChange={(v) => patch({ compatibilityRaw: v })}
            disabled={disabled}
            addLabel="Új típus"
            placeholder="Blum Clip top 110°"
          />
        </FormField>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-label font-semibold text-ink">Gyakori kérdések</p>
          <p className="text-hint text-ink-secondary">
            Amit a vásárlók telefonon vagy e-mailben kérdezni szoktak. Csak valódi, erre a termékre
            igaz választ írj.
          </p>
        </div>
        {faq.map((item, index) => (
          <div key={index} className="grid gap-x-3 gap-y-1.5 rounded-md border border-border p-2.5 sm:grid-cols-2">
            <FormField label="Kérdés" htmlFor={`faq-q-${index}`} optionalLabel>
              <Input
                id={`faq-q-${index}`}
                value={item.q}
                maxLength={300}
                disabled={disabled}
                placeholder="Milyen csavar kell hozzá?"
                onChange={(e) => {
                  const next = [...faq]
                  next[index] = { ...item, q: e.target.value }
                  setFaq(next)
                }}
              />
            </FormField>
            <FormField label="Válasz" htmlFor={`faq-a-${index}`} optionalLabel>
              <Textarea
                id={`faq-a-${index}`}
                value={item.a}
                rows={2}
                maxLength={2000}
                disabled={disabled}
                onChange={(e) => {
                  const next = [...faq]
                  next[index] = { ...item, a: e.target.value }
                  setFaq(next)
                }}
              />
            </FormField>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || (faq.length === 1 && !item.q && !item.a)}
                onClick={() =>
                  setFaq(faq.length === 1 ? [{ q: '', a: '' }] : faq.filter((_, i) => i !== index))
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
                Kérdés törlése
              </Button>
            </div>
          </div>
        ))}
        {faq.length < FAQ_MAX ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => setFaq([...faq, { q: '', a: '' }])}
          >
            <Plus className="size-3.5" aria-hidden />
            Új kérdés
          </Button>
        ) : null}
      </div>
    </div>
  )
}
