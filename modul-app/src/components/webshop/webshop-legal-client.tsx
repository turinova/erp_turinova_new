'use client'

import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { saveWebshopLegalSettings } from '@/lib/webshop/legal-actions'
import { COUNTIES, COUNTY_CODES } from '@/lib/webshop/legal/constants'
import type { SellerDefaults } from '@/lib/webshop/legal/context'
import type { CountyCode, LegalDocKind, LegalMissing, WebshopLegalSettings } from '@/lib/webshop/legal/types'

export type LegalDocRow = {
  kind: LegalDocKind
  title: string
  url: string | null
  external: boolean
  version: { version: number; createdAt: string } | null
}

type SellerKey =
  | 'sellerName'
  | 'taxNumber'
  | 'registrationNumber'
  | 'vatId'
  | 'postalCode'
  | 'city'
  | 'address'
  | 'email'
  | 'phone'

const SELLER_FIELDS: { key: SellerKey; label: string; span?: 2 | 4; type?: string; hint?: string }[] = [
  { key: 'sellerName', label: 'Cégnév', span: 2 },
  { key: 'taxNumber', label: 'Adószám' },
  { key: 'registrationNumber', label: 'Cégjegyzékszám / nyilvántartási szám' },
  { key: 'postalCode', label: 'Irányítószám' },
  { key: 'city', label: 'Város' },
  { key: 'address', label: 'Utca, házszám', span: 2 },
  { key: 'email', label: 'E-mail (vásárlóknak)', type: 'email', span: 2 },
  { key: 'phone', label: 'Telefon (vásárlóknak)' },
  { key: 'vatId', label: 'Közösségi adószám' }
]

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', { dateStyle: 'medium' }).format(new Date(iso))
}

export function WebshopLegalClient({
  canWrite,
  defaults,
  legal,
  autoCounty,
  missing,
  docs
}: {
  canWrite: boolean
  defaults: SellerDefaults
  legal: WebshopLegalSettings
  autoCounty: CountyCode | null
  missing: LegalMissing[]
  docs: LegalDocRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const erpValue = (k: SellerKey): string => (k === 'sellerName' ? defaults.sellerName : defaults[k]) ?? ''
  const [seller, setSeller] = useState<Record<SellerKey, string>>(() => {
    const out = {} as Record<SellerKey, string>
    for (const f of SELLER_FIELDS) out[f.key] = legal[f.key] ?? erpValue(f.key)
    return out
  })
  const [county, setCounty] = useState<string>(legal.county ?? '')
  const [serviceAddress, setServiceAddress] = useState(legal.serviceAddress ?? '')
  const [supportHours, setSupportHours] = useState(legal.supportHours ?? '')
  const [audience, setAudience] = useState(legal.audience)
  const [madeToOrder, setMadeToOrder] = useState(legal.madeToOrder)
  const [mandatoryWarranty, setMandatoryWarranty] = useState(legal.mandatoryWarranty)
  const [newsletter, setNewsletter] = useState(legal.newsletter)
  const [microEnterprise, setMicroEnterprise] = useState(legal.microEnterprise)
  const [termsUrl, setTermsUrl] = useState(legal.termsUrl ?? '')
  const [privacyUrl, setPrivacyUrl] = useState(legal.privacyUrl ?? '')

  const disabled = !canWrite || pending

  function handleSave() {
    startTransition(async () => {
      const result = await saveWebshopLegalSettings({
        ...seller,
        county: (county || null) as CountyCode | null,
        serviceAddress,
        supportHours,
        audience,
        madeToOrder,
        mandatoryWarranty,
        newsletter,
        microEnterprise,
        termsUrl,
        privacyUrl
      })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(Object.values(result.fieldErrors ?? {})[0] || result.message)
        return
      }
      setErrors({})
      toast.success('Jogi adatok mentve. A bolt oldalai frissülnek.')
      router.refresh()
    })
  }

  return (
    <div className="pb-14">
      <PageHeader
        title="Jogi oldalak"
        description="Az ÁSZF, az adatkezelési tájékoztató, az elállás és a többi kötelező oldal ezekből az adatokból készül, és minden változás új, megőrzött változatot kap."
        actions={
          canWrite ? (
            <Button type="button" loading={pending} onClick={handleSave}>
              Jogi adatok mentése
            </Button>
          ) : null
        }
      />

      <div className="space-y-3">
        <section
          aria-labelledby="legal-status"
          className="rounded-md border border-border bg-surface p-3.5"
        >
          <h2 id="legal-status" className="text-h3 text-ink">
            Állapot
          </h2>
          {missing.length === 0 ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-body text-ink">
              <CircleCheck className="size-4 text-success-ink" aria-hidden />
              Minden kötelező adat megvan.
            </p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              <p className="flex items-center gap-1.5 text-body text-ink">
                <CircleAlert className="size-4 text-warning-ink" aria-hidden />
                {missing.length} kötelező adat hiányzik — addig a jogi oldalak hiányosak.
              </p>
              <ul className="space-y-1 pl-6 text-body">
                {missing.map((m) => (
                  <li key={m.field}>
                    <Link href={m.href} className="text-ink underline underline-offset-2">
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {docs.map((d) => (
              <li key={d.kind} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-body">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-ink">{d.title}</span>
                  {d.external ? (
                    <StatusBadge tone="info">Saját dokumentum</StatusBadge>
                  ) : d.version ? (
                    <StatusBadge tone="neutral" variant="outline">
                      {d.version.version}. változat · {formatDate(d.version.createdAt)}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Még nincs közzétéve</StatusBadge>
                  )}
                </span>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink hover:underline"
                  >
                    Megnyitom
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <FormSection
          id="elado"
          title="Eladó adatai"
          description="Alapértelmezés szerint a Cégadatokból jön. Ha a webáruházban más adat szerepeljen, itt írd át — a Cégadatok nem változnak."
          columns={4}
        >
          {SELLER_FIELDS.map((f) => {
            const erp = erpValue(f.key)
            const fromErp = Boolean(erp) && seller[f.key].trim() === erp
            return (
              <FormField
                key={f.key}
                label={f.label}
                htmlFor={`lg-${f.key}`}
                optionalLabel={f.key === 'vatId'}
                hint={fromErp ? 'A Cégadatokból' : erp ? `Cégadatokban: ${erp}` : undefined}
                className={f.span === 2 ? 'sm:col-span-2' : f.span === 4 ? 'col-span-full' : undefined}
                error={errors[f.key]}
              >
                <Input
                  id={`lg-${f.key}`}
                  type={f.type ?? 'text'}
                  value={seller[f.key]}
                  onChange={(e) => setSeller((s) => ({ ...s, [f.key]: e.target.value }))}
                  disabled={disabled}
                />
              </FormField>
            )
          })}
          <FormField
            label="Székhely vármegyéje"
            htmlFor="lg-county"
            hint="Ebből választjuk ki az illetékes békéltető testületet és a cégbíróságot"
            className="sm:col-span-2"
            error={errors.county}
          >
            <Select id="lg-county" value={county} onChange={(e) => setCounty(e.target.value)} disabled={disabled}>
              <option value="">
                {autoCounty ? `Automatikus: ${COUNTIES[autoCounty].label}` : 'Válassz vármegyét'}
              </option>
              {COUNTY_CODES.map((c) => (
                <option key={c} value={c}>
                  {COUNTIES[c].label}
                </option>
              ))}
            </Select>
          </FormField>
        </FormSection>

        <FormSection title="Ügyfélszolgálat" description="A panaszkezelési és elállási tájékoztatóban jelenik meg." columns={4}>
          <FormField
            label="Levelezési, visszaküldési cím"
            htmlFor="lg-service"
            optionalLabel
            hint="Ha eltér a székhelytől (pl. raktár). Ide küldik vissza a termékeket."
            className="sm:col-span-2"
            error={errors.serviceAddress}
          >
            <Input
              id="lg-service"
              value={serviceAddress}
              onChange={(e) => setServiceAddress(e.target.value)}
              maxLength={300}
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Elérhetőség ideje"
            htmlFor="lg-hours"
            optionalLabel
            hint="Pl. H–P 8–16"
            className="sm:col-span-2"
            error={errors.supportHours}
          >
            <Input
              id="lg-hours"
              value={supportHours}
              onChange={(e) => setSupportHours(e.target.value)}
              maxLength={160}
              disabled={disabled}
            />
          </FormField>
        </FormSection>

        <FormSection title="Értékesítés" description="Ezek döntik el, mely szakaszok kerülnek a dokumentumokba." columns={4}>
          <FormField label="Kiknek értékesítesz?" htmlFor="lg-audience" className="sm:col-span-2">
            <Select
              id="lg-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value === 'business' ? 'business' : 'consumer')}
              disabled={disabled}
            >
              <option value="consumer">Magánszemélyeknek is (fogyasztói jogokkal)</option>
              <option value="business">Csak cégeknek (B2B)</option>
            </Select>
          </FormField>
          <div className="col-span-full space-y-2">
            <Switch
              id="lg-made"
              checked={madeToOrder}
              disabled={disabled}
              onCheckedChange={setMadeToOrder}
              label="Egyedi méretre gyártott vagy vágott termékek"
              description="Ezekre nem vonatkozik az elállási jog; az ÁSZF és az elállási oldal külön jelzi."
            />
            <Switch
              id="lg-mandatory"
              checked={mandatoryWarranty}
              disabled={disabled}
              onCheckedChange={setMandatoryWarranty}
              label="Kötelező jótállás alá tartozó termékek"
              description="Új, tartós fogyasztási cikkek 10 000 Ft felett (pl. háztartási gépek, bútorok)."
            />
            <Switch
              id="lg-newsletter"
              checked={newsletter}
              disabled={disabled}
              onCheckedChange={setNewsletter}
              label="Hírlevelet küldök"
              description="Az adatkezelési tájékoztató a hírlevél adatkezelését is tartalmazza."
            />
            <Switch
              id="lg-micro"
              checked={microEnterprise}
              disabled={disabled}
              onCheckedChange={setMicroEnterprise}
              label="Mikrovállalkozás vagyunk"
              description="10 főnél kevesebb munkavállaló és legfeljebb 2 millió euró éves árbevétel — az akadálymentességi nyilatkozat ezt jelzi."
            />
          </div>
        </FormSection>

        <FormSection
          title="Haladó: saját dokumentumok"
          description="Csak ha ügyvéd által írt saját ÁSZF-et vagy tájékoztatót használsz. Üresen a generált oldal él — ez ajánlott."
          columns={4}
        >
          <FormField
            label="Saját ÁSZF címe"
            htmlFor="lg-terms"
            optionalLabel
            hint="https://…"
            className="sm:col-span-2"
            error={errors.termsUrl}
          >
            <Input id="lg-terms" value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} maxLength={500} disabled={disabled} />
          </FormField>
          <FormField
            label="Saját adatkezelési tájékoztató címe"
            htmlFor="lg-privacy"
            optionalLabel
            hint="https://…"
            className="sm:col-span-2"
            error={errors.privacyUrl}
          >
            <Input
              id="lg-privacy"
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              maxLength={500}
              disabled={disabled}
            />
          </FormField>
        </FormSection>

        <p className="text-hint text-ink-secondary">
          Szállítási és fizetési módok, szállítási díj, visszaküldés, jótállás:{' '}
          <Link href="/webshop/beallitasok" className="text-ink underline underline-offset-2">
            Webshop → Bolt beállítások
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
