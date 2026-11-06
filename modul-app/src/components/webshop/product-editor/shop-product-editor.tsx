'use client'

import { ArrowRight, CircleAlert, ImageOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { AccessoryRelatedSection } from '@/components/accessories/accessory-related-section'
import { AiReadinessPanel } from '@/components/accessories/ai-readiness-panel'
import { PdpQualityPanel } from '@/components/accessories/pdp-quality-panel'
import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatMoneyFt } from '@/lib/accessories/parse'
import {
  evaluateShopReady,
  suggestWebDescriptionShort,
  SHOP_READY_LABEL,
  shopReadyTone
} from '@/lib/accessories/web-shop'
import { countryOptions } from '@/lib/geo/countries'
import { parseSpecNumber } from '@/lib/webshop/key-specs'
import { evaluateAiReadiness } from '@/lib/webshop/ai-readiness'
import type { WebshopShippingDefaults } from '@/lib/webshop/enrich'
import { saveShopProduct } from '@/lib/webshop/product-actions'
import {
  SHOP_SHORT_DESCRIPTION_MIN,
  shopRequirementIssues
} from '@/lib/webshop/product-parse'
import type { ShopProductDetail } from '@/lib/webshop/product-queries'
import { evaluatePdpQuality } from '@/lib/webshop/pdp-quality'
import type { ProductAttributeRow, WebCategoryRow } from '@/lib/webshop/types'

import { EditorGroup, groupDomId, type GroupStatus } from './editor-group'
import {
  linesOnly,
  specModel,
  webFormStateFromShop,
  webFormToPayload,
  webSpecInputErrors,
  type AccessoryWebFormState
} from './form-state'
import { BasicsGroup, QuestionsGroup, SpecsGroup } from './groups-content'
import { CompositionGroup, DimensionsGroup, PackagingGroup } from './groups-details'
import { AdvancedGroup, MediaGroup, VariantsGroup } from './groups-extra'

const CORE_PATH = '/torzsadatok/alapanyagok/termekek'
const CATALOG_PATH = '/webshop/katalogus'
const TODO_LIMIT = 5

type GroupId =
  | 'alapok'
  | 'jellemzok'
  | 'kerdesek'
  | 'kiszereles'
  | 'meretek'
  | 'osszetetel'
  | 'media'
  | 'kapcsolodo'
  | 'valtozatok'
  | 'halado'

const GROUP_IDS: GroupId[] = [
  'alapok',
  'jellemzok',
  'kerdesek',
  'kiszereles',
  'meretek',
  'osszetetel',
  'media',
  'kapcsolodo',
  'valtozatok',
  'halado'
]

/** 'alap' = ERP alapadat; 'agent' = Agent Top panel (#agent). */
type TodoTarget = GroupId | 'alap' | 'agent'

const FIELD_GROUP: Record<string, TodoTarget> = {
  imageUrl: 'alap',
  priceNet: 'alap',
  active: 'alap',
  webCategoryId: 'alapok',
  webDescriptionLong: 'agent',
  webDescriptionShort: 'agent',
  webNetQuantity: 'kiszereles',
  webMultipack: 'kiszereles',
  webPriceTiers: 'kiszereles',
  webCompareAtPrice: 'kiszereles',
  webDimensionImageUrl: 'meretek',
  webCountryOfOrigin: 'osszetetel',
  webSafetyInfo: 'osszetetel',
  webIngredients: 'osszetetel',
  webUsage: 'osszetetel',
  webVideoUrl: 'media',
  webImageAlts: 'media',
  webGroupId: 'valtozatok',
  webSlug: 'halado',
  webTitle: 'halado',
  webBrand: 'agent',
  webMpn: 'halado',
  webGoogleCategory: 'halado'
}

function groupForField(field: string): TodoTarget {
  if (field.startsWith('spec-')) return 'jellemzok'
  if (field.startsWith('shipping') || field.startsWith('product')) return 'meretek'
  return FIELD_GROUP[field] ?? 'halado'
}

const PDP_GROUP: Record<string, TodoTarget> = {
  images: 'alap',
  description: 'agent',
  benefits: 'kerdesek',
  'key-specs': 'jellemzok',
  'net-content': 'kiszereles',
  usage: 'osszetetel',
  ingredients: 'osszetetel',
  safety: 'osszetetel',
  origin: 'osszetetel',
  faq: 'kerdesek'
}

const AI_GROUP: Record<string, TodoTarget> = {
  image: 'alap',
  gallery: 'alap',
  brand: 'agent',
  identifier: 'halado',
  category: 'alapok',
  keyspecs: 'jellemzok',
  conflict: 'jellemzok',
  alt: 'media',
  description: 'agent',
  measure: 'meretek',
  dimensions: 'meretek'
}

type Todo = { key: string; text: string; target: TodoTarget; blocking: boolean }

function countryName(code: string): string | null {
  return countryOptions().find((c) => c.code === code)?.name ?? null
}

function statusOf(todo: number, filled: boolean): GroupStatus {
  if (todo > 0) return { kind: 'todo', count: todo }
  return filled ? { kind: 'done' } : { kind: 'optional' }
}

function snapshot(web: AccessoryWebFormState, alts: Record<string, string>): string {
  return JSON.stringify([web, alts])
}

export function ShopProductEditor({
  detail,
  categories,
  attributes,
  shippingDefaults,
  tenantId,
  canWrite
}: {
  detail: ShopProductDetail
  categories: WebCategoryRow[]
  attributes: ProductAttributeRow[]
  shippingDefaults: WebshopShippingDefaults | null
  tenantId: string
  canWrite: boolean
}) {
  const router = useRouter()
  const { core } = detail
  const [pending, startTransition] = useTransition()
  const [web, setWeb] = useState(() => webFormStateFromShop(detail))
  const [alts, setAlts] = useState<Record<string, string>>(() => detail.web.web_image_alts)
  const [saved, setSaved] = useState(() => snapshot(webFormStateFromShop(detail), detail.web.web_image_alts))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Set<GroupId>>(() => new Set())
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const disabled = pending || !canWrite
  const dirty = snapshot(web, alts) !== saved
  const patch = useCallback(
    (partial: Partial<AccessoryWebFormState>) => setWeb((prev) => ({ ...prev, ...partial })),
    []
  )

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (hash === 'agent') {
      requestAnimationFrame(() => document.getElementById('agent')?.scrollIntoView())
      return
    }
    const id = hash.replace('csoport-', '') as GroupId
    if (GROUP_IDS.includes(id)) {
      setAdvancedOpen(true)
      setOpen((prev) => new Set(prev).add(id))
      requestAnimationFrame(() => document.getElementById(groupDomId(id))?.scrollIntoView())
    }
  }, [])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id as GroupId)) next.delete(id as GroupId)
      else next.add(id as GroupId)
      return next
    })
  }

  function reveal(id: GroupId | 'agent') {
    if (id === 'agent') {
      window.history.replaceState(null, '', '#agent')
      requestAnimationFrame(() =>
        document.getElementById('agent')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      )
      return
    }
    setAdvancedOpen(true)
    setOpen((prev) => new Set(prev).add(id))
    window.history.replaceState(null, '', `#${groupDomId(id)}`)
    requestAnimationFrame(() =>
      document.getElementById(groupDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  }

  const images = useMemo(
    () => [core.image_url, ...core.gallery].filter((u): u is string => Boolean(u)),
    [core.image_url, core.gallery]
  )
  const model = useMemo(() => specModel(web, attributes, categories), [web, attributes, categories])

  const payload = useMemo(
    () =>
      webFormToPayload(web, attributes, {
        productName: core.name,
        manufacturerName: core.manufacturer_name,
        barcode: core.barcode ?? '',
        sku: core.sku,
        shippingDefaults
      }),
    [web, attributes, core, shippingDefaults]
  )

  const issues = useMemo(
    () =>
      shopRequirementIssues(
        {
          webSlug: payload.webSlug,
          webTitle: payload.webTitle,
          webDescriptionLong: payload.webDescriptionLong,
          webDescriptionShort: payload.webDescriptionShort,
          webCategoryId: payload.webCategoryId,
          webProductType: payload.webProductType
        },
        { name: core.name, imageUrl: core.image_url, priceNet: core.price_net, active: core.active }
      ),
    [payload, core]
  )

  const imagesWithAlt = images.filter((u) => alts[u]?.trim()).length
  const primaryKey = model.keyAttrs[0]
  const primaryNum =
    primaryKey && (primaryKey.valueType === 'number' || primaryKey.valueType === 'range')
      ? parseSpecNumber(web.specInputs[primaryKey.id]?.numRaw ?? '')
      : null
  const hasCategory = Boolean(web.webCategoryId || web.webProductType.trim())

  const ai = evaluateAiReadiness({
    title: web.webTitle.trim() || core.name,
    description: web.webDescriptionLong.trim() || null,
    brand: web.webBrand.trim() || core.manufacturer_name,
    gtin: web.webGtin.trim() || core.barcode,
    mpn: web.webMpn.trim() || null,
    identifierExists: web.identifierExists,
    imageCount: images.length,
    imagesWithAlt,
    keySpecsTotal: model.keyAttrs.length,
    keySpecsFilled: model.keyFilled,
    hasMeasureImage: Boolean(web.dimensionImageUrl.trim() || model.template.measureImageUrl),
    hasProductDimensions: Boolean(
      web.productLengthRaw.trim() || web.productWidthRaw.trim() || web.productHeightRaw.trim()
    ),
    hasCategory,
    primarySpec: primaryKey
      ? {
          name: primaryKey.name,
          value: primaryNum != null && !Number.isNaN(primaryNum) ? primaryNum : null,
          unit: primaryKey.unit
        }
      : null
  })

  const faqCount = web.faqItems.filter((f) => f.q.trim() && f.a.trim()).length
  const pdp = evaluatePdpQuality({
    googleCategory: web.webGoogleCategory,
    productType: web.webProductType,
    imageCount: images.length,
    descriptionLength: web.webDescriptionLong.trim().length,
    keySpecsTotal: model.keyAttrs.length,
    keySpecsFilled: model.keyFilled,
    benefitCount: linesOnly(web.useCasesRaw).length,
    hasNetContent: Number(web.netQuantityRaw.replace(',', '.')) > 0 && Boolean(web.netUnit),
    hasIngredients: Boolean(web.ingredients.trim()),
    hasUsage: Boolean(web.usage.trim()),
    hasSafetyInfo: Boolean(web.safetyInfo.trim()),
    faqCount,
    hasCountryOfOrigin: Boolean(web.countryOfOrigin)
  })

  const ready = evaluateShopReady({
    ...detail.web,
    sellable_web: web.sellableWeb,
    web_slug: payload.webSlug,
    web_title: payload.webTitle,
    web_description_short: payload.webDescriptionShort,
    web_description_long: payload.webDescriptionLong,
    web_brand: payload.webBrand,
    web_gtin: payload.webGtin,
    web_mpn: payload.webMpn,
    web_product_type: payload.webProductType,
    web_google_category: payload.webGoogleCategory,
    web_search_aliases: payload.webSearchAliases,
    web_color: payload.webColor,
    web_size: payload.webSize,
    web_material: payload.webMaterial,
    web_attributes: payload.webAttributes,
    web_specs: payload.webSpecs,
    web_faq: payload.webFaq,
    web_use_cases: payload.webUseCases,
    web_compatibility: payload.webCompatibility,
    shipping_weight_kg: payload.shippingWeightKg,
    web_identifier_exists: payload.webIdentifierExists,
    web_gallery: core.gallery,
    name: core.name,
    image_url: core.image_url,
    barcode: core.barcode,
    manufacturer_name: core.manufacturer_name,
    price_net: core.price_net,
    active: core.active
  })

  const todos = useMemo(() => {
    const out: Todo[] = issues.map((i) => ({
      key: `req-${i.field}`,
      text: i.message,
      target: groupForField(i.field),
      blocking: true
    }))
    const seen = new Set(out.map((t) => t.target + t.text))
    const add = (key: string, text: string, target: TodoTarget | undefined) => {
      if (!target) return
      const k = target + text
      if (seen.has(k)) return
      if (out.some((t) => t.blocking && t.target === target)) return
      seen.add(k)
      out.push({ key, text, target, blocking: false })
    }
    for (const c of ai.blockers) add(`ai-${c.id}`, c.fix, AI_GROUP[c.id])
    for (const c of pdp.failing) add(`pdp-${c.id}`, c.fix, PDP_GROUP[c.id])
    for (const c of ai.warnings) add(`ai-${c.id}`, c.fix, AI_GROUP[c.id])
    return out
  }, [issues, ai, pdp])

  const todoCount = (target: TodoTarget) => todos.filter((t) => t.target === target).length

  function handleSave() {
    if (!canWrite) return
    const specErrors = webSpecInputErrors(web, attributes)
    const firstSpec = Object.keys(specErrors)[0]
    if (firstSpec) {
      setFieldErrors(specErrors)
      reveal('jellemzok')
      toast.error(specErrors[firstSpec])
      return
    }
    const imageSet = new Set(images)
    const input = {
      ...payload,
      webImageAlts: Object.fromEntries(
        Object.entries(alts)
          .map(([u, a]) => [u, a.trim()] as const)
          .filter(([u, a]) => a && imageSet.has(u))
      )
    }
    const wantLive = web.sellableWeb
    const agentOk = ai.feedEligible
    startTransition(async () => {
      const result = await saveShopProduct(core.id, input)
      if (!result.ok) {
        const errors = result.fieldErrors ?? {}
        setFieldErrors(errors)
        const first = Object.keys(errors)[0]
        if (first) {
          const target = groupForField(first)
          if (target !== 'alap') reveal(target)
        }
        toast.error(result.message)
        return
      }
      setFieldErrors({})
      setSaved(snapshot(web, alts))
      toast.success(
        wantLive
          ? agentOk
            ? 'Mentve — Live és Agent Top rendben.'
            : 'Mentve — Live be. Agent Tophoz még hiányzik adat.'
          : 'Mentve — nincs Live (nem látszik a boltban).'
      )
      router.refresh()
    })
  }

  function discard() {
    const initial = webFormStateFromShop(detail)
    setWeb(initial)
    setAlts(detail.web.web_image_alts)
    setFieldErrors({})
  }

  const category = categories.find((c) => c.id === web.webCategoryId)
  const categoryLabel = category
    ? category.parentName
      ? `${category.parentName} › ${category.name}`
      : category.name
    : null
  const useCaseCount = linesOnly(web.useCasesRaw).length
  const dims = [web.productLengthRaw, web.productWidthRaw, web.productHeightRaw]
    .map((v) => v.trim())
    .filter(Boolean)
  const compositionBits = [
    web.ingredients.trim() && 'összetevők',
    web.usage.trim() && 'használat',
    web.safetyInfo.trim() && 'figyelmeztetés',
    web.countryOfOrigin && countryName(web.countryOfOrigin)
  ].filter(Boolean)
  const packagingBits = [
    web.netQuantityRaw.trim() && web.netUnit && `${web.netQuantityRaw} ${web.netUnit}`,
    web.multipackRaw && `${web.multipackRaw} db/csomag`,
    web.isBundle && 'csomagajánlat',
    linesOnly(web.boxContentsRaw).length > 0 && `${linesOnly(web.boxContentsRaw).length} tétel a dobozban`,
    web.priceTiersRaw.trim() && 'mennyiségi ár'
  ].filter(Boolean)

  const groupProps = { web, patch, disabled, fieldErrors }

  const liveOnly = issues.slice(0, TODO_LIMIT)
  const descLen = web.webDescriptionLong.trim().length
  const descLeft = SHOP_SHORT_DESCRIPTION_MIN - descLen

  return (
    <div>
      <PageHeader
        title={core.name}
        description="Live = bolt · Agent Top = feed / LLM. Az ERP ár és kép az alapadatoknál."
        actions={
          <Button type="button" variant="secondary" onClick={() => router.push(CATALOG_PATH)}>
            Vissza a katalógushoz
          </Button>
        }
      />

      {!canWrite ? (
        <p
          className="mb-3 max-w-xl rounded-md border border-border bg-subtle p-3 text-body text-ink-secondary"
          role="status"
        >
          Csak olvasási jogod van — a mezők nem szerkeszthetők.
        </p>
      ) : null}

      <div className="w-full max-w-5xl space-y-2.5">
        <section className="flex gap-3 rounded-md border border-border bg-surface p-3.5">
          <div className="size-16 shrink-0 overflow-hidden rounded border border-border bg-subtle">
            {core.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={core.image_url} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-muted">
                <ImageOff className="size-5" aria-label="Nincs kép" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-body font-medium text-ink">{core.name}</p>
            <p className="text-hint text-ink-secondary">
              {core.sku} · {formatMoneyFt(core.price_gross)} / {core.unit_shortform} ·{' '}
              {core.active ? 'Aktív' : 'Inaktív'} · {images.length} kép
            </p>
            <Link
              href={`${CORE_PATH}/${core.id}`}
              className="inline-flex items-center gap-1 text-hint text-ink underline underline-offset-2"
            >
              Név, ár, képek — alapadatok
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="space-y-2 rounded-md border border-border bg-surface p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Switch
              id="shop-sellable"
              checked={web.sellableWeb}
              disabled={disabled}
              onCheckedChange={(v) => patch({ sellableWeb: v })}
              label="Live a boltban"
              description="Mentéskor lép életbe. A pult (POS) ettől független."
            />
            <StatusBadge tone={shopReadyTone(ready.level)}>{SHOP_READY_LABEL[ready.level]}</StatusBadge>
          </div>
          {web.sellableWeb && issues.length > 0 ? (
            <p
              className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-hint text-warning-ink"
              role="status"
            >
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              Live nem menthető bekapcsolva — pótold a hiányokat.
            </p>
          ) : null}
          {liveOnly.length > 0 ? (
            <ol className="divide-y divide-border rounded-md border border-border">
              {liveOnly.map((i) => {
                const isCore =
                  i.field === 'imageUrl' || i.field === 'priceNet' || i.field === 'active'
                if (isCore) {
                  return (
                    <li key={i.field}>
                      <Link
                        href={`${CORE_PATH}/${core.id}`}
                        className="flex min-h-9 items-center gap-2 px-2.5 py-1.5 text-body text-ink hover:bg-subtle"
                      >
                        <TodoMark blocking />
                        <span className="min-w-0 flex-1">{i.message}</span>
                        <span className="shrink-0 text-hint text-ink-secondary">Alapadatok</span>
                        <ArrowRight className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                      </Link>
                    </li>
                  )
                }
                return (
                  <li key={i.field}>
                    <button
                      type="button"
                      onClick={() => {
                        const t = groupForField(i.field)
                        if (t === 'alap') return
                        reveal(t)
                      }}
                      className="flex min-h-9 w-full items-center gap-2 px-2.5 py-1.5 text-left text-body text-ink hover:bg-subtle"
                    >
                      <TodoMark blocking />
                      <span className="min-w-0 flex-1">{i.message}</span>
                      <span className="shrink-0 text-hint text-ink-secondary">Megnyitás</span>
                      <ArrowRight className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : null}
        </section>

        <section
          id="agent"
          className="scroll-mt-16 space-y-2.5 rounded-md border border-border bg-surface p-3.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h3 text-ink">Agent Top</h2>
            <StatusBadge tone={ai.feedEligible ? 'success' : web.sellableWeb ? 'warning' : 'neutral'}>
              {ai.feedEligible ? 'Kész' : web.sellableWeb ? 'Hiányzik' : 'Live után'}
            </StatusBadge>
          </div>
          {!web.sellableWeb ? (
            <p className="text-hint text-ink-secondary">
              Először kapcsold be a Live-ot — utána érdemes az Agent Top mezőket kitölteni.
            </p>
          ) : null}
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
            <FormField
              label="Márka"
              htmlFor="shop-brand-agent"
              optionalLabel
              hint="Ha üres, a gyártó neve. Feedhez kell."
              error={fieldErrors.webBrand}
            >
              <Input
                id="shop-brand-agent"
                value={web.webBrand}
                onChange={(e) => patch({ webBrand: e.target.value })}
                maxLength={120}
                disabled={disabled}
                placeholder={core.manufacturer_name ?? undefined}
              />
            </FormField>
            <div className="hidden sm:block" />
            <FormField
              label="Leírás (Agent Top)"
              htmlFor="shop-description-agent"
              error={fieldErrors.webDescriptionLong}
              hint={
                descLeft > 0
                  ? `${descLen} karakter — még legalább ${descLeft} kell a feedhez.`
                  : `${descLen} karakter — elég az Agent Tophoz.`
              }
              className="sm:col-span-2"
            >
              <Textarea
                id="shop-description-agent"
                value={web.webDescriptionLong}
                onChange={(e) =>
                  patch({
                    webDescriptionLong: e.target.value,
                    webDescriptionShort: suggestWebDescriptionShort(e.target.value)
                  })
                }
                rows={5}
                maxLength={5000}
                disabled={disabled}
                placeholder="Tényszerűen: mi ez, mire való, fő méret / anyag."
              />
            </FormField>
          </div>
          {ai.blockers.length > 0 ? (
            <ul className="space-y-1 text-hint text-warning-ink">
              {ai.blockers.slice(0, 4).map((c) => (
                <li key={c.id} className="flex gap-1.5">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium">{c.label}.</span> {c.fix}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-hint text-success-ink">Agent Top checklist OK — mehet a feedbe.</p>
          )}
          <details className="mt-1">
            <summary className="cursor-pointer text-hint text-ink-secondary">
              Részletek: Agent {ai.score}/100 · termékoldal {pdp.score}/100
            </summary>
            <div className="mt-2 grid gap-2.5 lg:grid-cols-2">
              <AiReadinessPanel result={ai} />
              <PdpQualityPanel result={pdp} />
            </div>
          </details>
        </section>

        <details
          className="rounded-md border border-border bg-surface"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-3.5 py-2.5 text-body font-medium text-ink">
            Haladó mezők
            <span className="ml-2 text-hint font-normal text-ink-secondary">
              kategória, kulcsadat, GYIK, méret, média…
            </span>
          </summary>
          <div className="space-y-2.5 border-t border-border p-2.5 pt-2">
            <EditorGroup
              id="alapok"
              title="Kategória a boltban"
              summary={`${categoryLabel ?? 'Nincs kategória'}`}
              status={statusOf(todoCount('alapok'), hasCategory)}
              open={open.has('alapok')}
              onToggle={toggle}
            >
              <BasicsGroup {...groupProps} categories={categories} />
            </EditorGroup>

            <EditorGroup
              id="jellemzok"
              title="Kulcsadatok és jellemzők"
              summary={
                model.keyAttrs.length > 0
                  ? `${model.keyFilled}/${model.keyAttrs.length} kulcsadat`
                  : 'Nincs kulcsadat'
              }
              status={
                model.keyAttrs.length === 0
                  ? { kind: 'optional' }
                  : statusOf(model.keyAttrs.length - model.keyFilled, true)
              }
              open={open.has('jellemzok')}
              onToggle={toggle}
            >
              <SpecsGroup
                {...groupProps}
                attributes={attributes}
                model={model}
                productName={core.name}
              />
            </EditorGroup>

            <EditorGroup
              id="kerdesek"
              title="Amit a vásárló kérdez"
              summary={`${useCaseCount} előny · ${faqCount} Q&A`}
              status={statusOf(todoCount('kerdesek'), useCaseCount > 0 || faqCount > 0)}
              open={open.has('kerdesek')}
              onToggle={toggle}
            >
              <QuestionsGroup {...groupProps} />
            </EditorGroup>

            <EditorGroup
              id="kiszereles"
              title="Kiszerelés és mennyiségi ár"
              summary={packagingBits.length > 0 ? packagingBits.join(' · ') : 'Nincs'}
              status={statusOf(todoCount('kiszereles'), packagingBits.length > 0)}
              open={open.has('kiszereles')}
              onToggle={toggle}
            >
              <PackagingGroup {...groupProps} unitShortform={core.unit_shortform} />
            </EditorGroup>

            <EditorGroup
              id="meretek"
              title="Méretek és szállítás"
              summary={dims.length > 0 ? `${dims.join(' × ')} cm` : 'Nincs'}
              status={statusOf(0, dims.length > 0 || Boolean(web.dimensionImageUrl))}
              open={open.has('meretek')}
              onToggle={toggle}
            >
              <DimensionsGroup {...groupProps} tenantId={tenantId} />
            </EditorGroup>

            <EditorGroup
              id="osszetetel"
              title="Összetétel, eredet, biztonság"
              summary={compositionBits.length > 0 ? compositionBits.join(' · ') : 'Nincs'}
              status={statusOf(todoCount('osszetetel'), compositionBits.length > 0)}
              open={open.has('osszetetel')}
              onToggle={toggle}
            >
              <CompositionGroup {...groupProps} />
            </EditorGroup>

            <EditorGroup
              id="media"
              title="Képleírás, videó, dokumentumok"
              summary={`${imagesWithAlt}/${images.length} alt`}
              status={statusOf(0, imagesWithAlt > 0 || Boolean(web.videoUrl.trim()))}
              open={open.has('media')}
              onToggle={toggle}
            >
              <MediaGroup
                {...groupProps}
                images={images}
                alts={alts}
                onAltsChange={setAlts}
                accessoryId={core.id}
                tenantId={tenantId}
              />
            </EditorGroup>

            <EditorGroup
              id="kapcsolodo"
              title="Kapcsolódó termékek"
              summary="Kell hozzá / illik / helyettesít"
              status={{ kind: 'instant' }}
              open={open.has('kapcsolodo')}
              onToggle={toggle}
            >
              <AccessoryRelatedSection accessoryId={core.id} disabled={disabled} embedded />
            </EditorGroup>

            <EditorGroup
              id="valtozatok"
              title="Változatok"
              summary={web.webGroupId.trim() ? `Csoport: ${web.webGroupId.trim()}` : 'Nincs'}
              status={statusOf(0, Boolean(web.webGroupId.trim()))}
              open={open.has('valtozatok')}
              onToggle={toggle}
            >
              <VariantsGroup {...groupProps} accessoryId={core.id} />
            </EditorGroup>

            <EditorGroup
              id="halado"
              title="Slug, cím, MPN…"
              summary={`/p/${payload.webSlug ?? '…'}`}
              status={statusOf(fieldErrors.webSlug ? 1 : 0, false)}
              open={open.has('halado')}
              onToggle={toggle}
            >
              <AdvancedGroup
                {...groupProps}
                productName={core.name}
                manufacturerName={core.manufacturer_name}
              />
            </EditorGroup>
          </div>
        </details>
      </div>

      {canWrite ? (
        <div className="sticky bottom-0 z-10 mt-3 max-w-5xl border-t border-border bg-app/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          <div className="flex items-center justify-end gap-2 py-2.5">
            <span className="mr-auto text-hint text-ink-secondary" role="status">
              {dirty ? 'Nem mentett változások' : 'Minden mentve'}
            </span>
            {dirty ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={discard}>
                Elvetés
              </Button>
            ) : null}
            <Button type="button" loading={pending} disabled={!dirty} onClick={handleSave}>
              Mentés
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TodoMark({ blocking }: { blocking: boolean }) {
  return blocking ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-hint font-medium text-danger-ink">
      <CircleAlert className="size-3.5" aria-hidden />
      Kötelező
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 text-hint text-ink-secondary">
      <CircleAlert className="size-3.5" aria-hidden />
      Ajánlott
    </span>
  )
}
