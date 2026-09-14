'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { upsertCuttingFee } from '@/lib/cutting-fees/actions'
import { netToGross, type PricingMode } from '@/lib/cutting-fees/parse'
import type {
  CuttingFeeRow,
  TaxRateOption
} from '@/lib/cutting-fees/queries'
import { cn } from '@/lib/utils'

type OptiSettingsFormProps = {
  initial: CuttingFeeRow | null
  taxRates: TaxRateOption[]
  canWrite: boolean
}

const PRICING_OPTIONS: Array<{
  value: PricingMode
  title: string
  summary: string
  points: string[]
  when: string
  example: string
}> = [
  {
    value: 'standard',
    title: 'Standard — küszöbös (ajánlott)',
    summary:
      'Úgy számol, ahogy a legtöbb asztalosműhely: ha keveset vágsz ki egy táblából, csak a kivágott méretet (plusz egy kis hulladékot) számlázod; ha sokat kihasználod a táblát, már a teljes tábla árát kéred el.',
    points: [
      'A program megnézi táblánként: hány százalékát fedik le a panelek (pl. 40% vagy 80%).',
      'Ha ez a szám kisebb, mint az anyagnál beállított küszöb (pl. 65%), akkor: kivágott terület × hulladékszorzó × m²-ár. Tehát nem a teljes táblát, hanem a tényleges lapokat számlázod, egy kis ráhagyással a hulladékra.',
      'Ha eléred vagy átléped a küszöböt: a teljes tábla m²-árát számlázod — mert a maradék darab már nehezen használható fel máshova.',
      'Ha az anyag „nem raktári” (külön rendelés / nincs készleten): mindig teljes táblát számláz — nincs küszöbözés.',
      'A küszöböt és a hulladékszorzót az adott táblás anyagnál állítod (Törzsadatok), nem itt.'
    ],
    when: 'Akkor válaszd, ha raktárról dolgoztok, és igazságos, de a nagy kihasználtságnál már a teljes táblát akarjátok érvényesíteni.',
    example:
      'Egy 2800×2070-es tábla, küszöb 65%. 40%-nyi panel → panelterület × pl. 1,2 hulladék. 80%-nyi panel → egy teljes tábla ára.'
  },
  {
    value: 'always_full_board',
    title: 'Mindig teljes tábla',
    summary:
      'Egyszerű szabály: ahány táblát az optimalizálás felhasznál, annyi teljes tábla árát számlázod — mindegy, hogy a táblán 20% vagy 90% a panelek.',
    points: [
      'Nincs küszöb, nincs „csak a kivágott rész” számítás.',
      'Ha az Opti 2 táblát használ fel, az ügyfél 2 teljes tábla anyagárát fizeti (plusz él, vágás stb.).',
      'A hulladékszorzó és a kihasználtság-küszöb ebben a módban nem számít a lapanyag árához.',
      'Konzervatív: kevesebb a vita, de a kis megrendeléseknél drágább lehet az ajánlat.'
    ],
    when: 'Akkor válaszd, ha mindig teljes táblában gondolkodtok (pl. egyedi rendelés, vagy nem akartok százalékokkal magyarázkodni).',
    example:
      'Akár 15%, akár 95% a kihasználtság ugyanazon a táblán: az ár mindig 1 teljes tábla. Két tábla kell → két teljes tábla ára.'
  },
  {
    value: 'always_panel_area',
    title: 'Mindig a kivágott lapok szerint',
    summary:
      'Mindig csak azt számlázod, amit ténylegesen kivágtok: a panelek területe × az anyagnál beállított hulladékszorzó. Soha nem „ugrik át” teljes tábla árra, még 90%-os kihasználtságnál sem.',
    points: [
      'Számítás: összes panel m² a táblán × hulladékszorzó × m²-ár.',
      'A kihasználtság-küszöb ebben a módban nem kapcsol át teljes táblára.',
      'A hulladékszorzó továbbra is számít (pl. 1,2 = 20% ráhagyás a vágási hulladékra).',
      'Ügyfélbarátabb kis / közepes megrendeléseknél; nagy kitöltésnél viszont olcsóbb lehet, mint a teljes tábla.'
    ],
    when: 'Akkor válaszd, ha a kivágott méret alapján akartok árazni, és a maradékot ti használjátok fel később — vagy ha a teljes tábla-ár túl magasnak tűnik a vevőnek.',
    example:
      '80% kihasználtság is: csak a panel m² × hulladékszorzó. Nem lesz belőle „teljes tábla” tétel az ajánlatban.'
  }
]

function defaultTaxRateId(
  initial: CuttingFeeRow | null,
  taxRates: TaxRateOption[]
): string {
  if (initial?.tax_rate_id) return initial.tax_rate_id
  const def = taxRates.find((t) => t.is_default)
  return def?.id ?? taxRates[0]?.id ?? ''
}

function initialGross(
  initial: CuttingFeeRow | null,
  taxRates: TaxRateOption[],
  taxRateId: string
): string {
  if (!initial) return ''
  const rate =
    taxRates.find((t) => t.id === taxRateId)?.rate_percent ??
    initial.tax_rate_percent
  return String(netToGross(initial.fee_per_meter, rate))
}

export function OptiSettingsForm({
  initial,
  taxRates,
  canWrite
}: OptiSettingsFormProps) {
  const [pending, startTransition] = useTransition()
  const [taxRateId, setTaxRateId] = useState(() =>
    defaultTaxRateId(initial, taxRates)
  )
  const [grossRaw, setGrossRaw] = useState(() =>
    initialGross(initial, taxRates, defaultTaxRateId(initial, taxRates))
  )
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    () => initial?.pricing_mode ?? 'standard'
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const taxOptions = useMemo(
    () =>
      taxRates.map((t) => ({
        value: t.id,
        label: `${t.name} (${t.rate_percent}%)`
      })),
    [taxRates]
  )

  const selectedRate = taxRates.find((t) => t.id === taxRateId)
  const previewNet =
    selectedRate && Number(grossRaw.replace(',', '.')) > 0
      ? Math.round(
          Number(grossRaw.trim().replace(/\s/g, '').replace(',', '.')) /
            (1 + selectedRate.rate_percent / 100)
        )
      : null

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const result = await upsertCuttingFee({
        feePerMeterGrossRaw: grossRaw,
        taxRateId,
        pricingMode
      })
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      setFieldErrors({})
      toast.success('Opti beállítások mentve.')
    })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Opti beállítások"
        description="Vágási díj, ÁFA és lapanyag árazási mód."
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={handleSave}
              loading={pending}
              disabled={taxRates.length === 0}
            >
              Mentés
            </Button>
          ) : undefined
        }
      />

      {!canWrite ? (
        <p className="text-body text-ink-secondary">
          Csak megtekintési jogod van — nem módosíthatsz.
        </p>
      ) : null}

      {taxRates.length === 0 ? (
        <p
          className="max-w-xl rounded-md border border-warning/30 bg-warning-soft p-3 text-body text-warning-ink"
          role="status"
        >
          Nincs adónem. Először hozz létre egyet az{' '}
          <Link
            href="/torzsadatok/rendszer/adonem"
            className="underline underline-offset-2"
          >
            Adónem
          </Link>{' '}
          oldalon.
        </p>
      ) : null}

      <FormSection
        title="Vágási díj"
        description="A bruttó Ft/m-t tároljuk nettóként az ÁFA kulccsal."
        columns={2}
      >
        <FormField
          label="Vágási díj méterenként (bruttó)"
          htmlFor="opti-fee-gross"
          required
          error={fieldErrors.feePerMeterGross}
          hint={
            !fieldErrors.feePerMeterGross && previewNet != null
              ? `Nettó: ${previewNet} Ft/m`
              : 'Ft/m (bruttó)'
          }
        >
          <Input
            id="opti-fee-gross"
            inputMode="decimal"
            value={grossRaw}
            disabled={!canWrite || pending}
            onChange={(e) => {
              setGrossRaw(e.target.value)
              if (fieldErrors.feePerMeterGross) {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.feePerMeterGross
                  return next
                })
              }
            }}
          />
        </FormField>

        <FormField
          label="ÁFA kulcs"
          htmlFor="opti-tax-rate"
          required
          error={fieldErrors.taxRateId}
          hint={
            !fieldErrors.taxRateId
              ? 'Az Adónem törzsből választható.'
              : undefined
          }
        >
          <MenuSelect
            id="opti-tax-rate"
            value={taxRateId}
            options={taxOptions}
            allowEmpty={false}
            placeholder="Válassz ÁFA kulcsot…"
            disabled={!canWrite || pending || taxRates.length === 0}
            onChange={(value) => {
              setTaxRateId(value)
              if (fieldErrors.taxRateId) {
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next.taxRateId
                  return next
                })
              }
            }}
          />
        </FormField>
      </FormSection>

      <section className="rounded-md border border-border bg-surface p-3.5">
        <div className="mb-3 space-y-1.5">
          <h2 className="text-h3 text-ink">Lapanyag árazási mód</h2>
          <p className="max-w-2xl text-body text-ink-secondary">
            Ez dönti el, hogyan számoljuk a{' '}
            <strong className="font-medium text-ink">bútorlap / táblás anyag</strong>{' '}
            árát az Opti árajánlatban. Az élzáró és a vágási díj ettől független.
          </p>
          <p className="max-w-2xl text-hint text-ink-secondary">
            Röviden: a táblából kivágtok paneleket. Kérdés: az ügyfél a{' '}
            <em>kivágott méretet</em> fizeti (kis hulladékkal), vagy a{' '}
            <em>teljes táblát</em>? A három mód erre ad választ.
          </p>
          <p className="max-w-2xl text-hint text-ink-muted">
            A küszöböt (pl. 65%) és a hulladékszorzót (pl. 1,2) az egyes
            anyagoknál állítod a Törzsadatokban — itt csak a céges szabályt
            választod.
          </p>
        </div>
        <fieldset disabled={!canWrite || pending} className="space-y-2.5">
          <legend className="sr-only">Árazási mód</legend>
          {PRICING_OPTIONS.map((opt) => {
            const active = pricingMode === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer gap-2.5 rounded-md border px-3 py-3 transition-colors',
                  active
                    ? 'border-ink bg-subtle ring-1 ring-ink'
                    : 'border-border hover:bg-subtle/60'
                )}
              >
                <input
                  type="radio"
                  name="pricing-mode"
                  value={opt.value}
                  checked={active}
                  onChange={() => setPricingMode(opt.value)}
                  className="mt-1 size-3.5 shrink-0 accent-ink"
                />
                <span className="min-w-0 space-y-2">
                  <span className="block text-body font-semibold text-ink">
                    {opt.title}
                  </span>
                  <span className="block text-body text-ink-secondary">
                    {opt.summary}
                  </span>
                  <ul className="list-disc space-y-1 pl-4 text-hint text-ink-secondary">
                    {opt.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <span className="block text-hint text-ink">
                    <span className="font-medium">Mikor használd: </span>
                    {opt.when}
                  </span>
                  <span className="block rounded border border-border bg-surface px-2.5 py-1.5 text-hint text-ink-secondary">
                    <span className="font-medium text-ink">Példa: </span>
                    {opt.example}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {fieldErrors.pricingMode ? (
          <p className="mt-2 text-hint text-danger-ink" role="alert">
            {fieldErrors.pricingMode}
          </p>
        ) : null}
      </section>
    </div>
  )
}
