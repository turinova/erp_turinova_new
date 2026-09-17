'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Textarea } from '@/components/ui/textarea'
import type { PaymentMethodOption } from '@/lib/payment-methods/queries'
import {
  createSupplier,
  updateSupplier
} from '@/lib/suppliers/actions'
import {
  emptyAddressInput,
  emptyContactInput,
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE,
  SUPPLIER_CURRENCIES,
  SUPPLIER_STATUS_LABEL,
  type SupplierCurrency,
  type SupplierFormInput,
  type SupplierStatus
} from '@/lib/suppliers/parse'
import type { SupplierDetail } from '@/lib/suppliers/queries'
import type { TaxRateListItem } from '@/lib/tax-rates/queries'

type SupplierFormProps = {
  mode: 'create' | 'edit'
  initial?: SupplierDetail | null
  canWrite: boolean
  taxRates: TaxRateListItem[]
  paymentMethods: PaymentMethodOption[]
}

function detailToForm(initial?: SupplierDetail | null): SupplierFormInput {
  if (!initial) {
    return {
      name: '',
      email: '',
      phone: '',
      website: '',
      taxNumber: '',
      euVatNumber: '',
      companyRegNumber: '',
      iban: '',
      bic: '',
      accountHolder: '',
      notes: '',
      status: 'active',
      defaultCurrency: 'HUF',
      defaultTaxRateId: '',
      defaultPaymentMethodId: '',
      defaultPaymentTermsDays: 30,
      addresses: [emptyAddressInput(true)],
      contacts: []
    }
  }

  return {
    name: initial.name,
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    website: initial.website ?? '',
    taxNumber: initial.tax_number ?? '',
    euVatNumber: initial.eu_vat_number ?? '',
    companyRegNumber: initial.company_reg_number ?? '',
    iban: initial.iban ?? '',
    bic: initial.bic ?? '',
    accountHolder: initial.account_holder ?? '',
    notes: initial.notes ?? '',
    status: initial.status,
    defaultCurrency: initial.default_currency,
    defaultTaxRateId: initial.default_tax_rate_id ?? '',
    defaultPaymentMethodId: initial.default_payment_method_id ?? '',
    defaultPaymentTermsDays: initial.default_payment_terms_days,
    addresses:
      initial.addresses.length > 0
        ? initial.addresses.map((a) => ({
            label: a.label ?? '',
            addressType: 'billing' as const,
            country: a.country || 'Magyarország',
            postalCode: a.postal_code ?? '',
            city: a.city ?? '',
            street: a.street ?? '',
            houseNumber: a.house_number ?? '',
            isDefault: a.is_default
          }))
        : [emptyAddressInput(true)],
    contacts: initial.contacts.map((c) => ({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      isPrimary: c.is_primary,
      note: c.note ?? ''
    }))
  }
}

function updateAddress(
  form: SupplierFormInput,
  index: number,
  patch: Partial<SupplierFormInput['addresses'][number]>
): SupplierFormInput['addresses'] {
  return form.addresses.map((a, i) => (i === index ? { ...a, ...patch } : a))
}

function updateContact(
  form: SupplierFormInput,
  index: number,
  patch: Partial<SupplierFormInput['contacts'][number]>
): SupplierFormInput['contacts'] {
  return form.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c))
}

export function SupplierForm({
  mode,
  initial,
  canWrite,
  taxRates,
  paymentMethods
}: SupplierFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<SupplierFormInput>(() =>
    detailToForm(initial)
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function patch(p: Partial<SupplierFormInput>) {
    setForm((prev) => ({ ...prev, ...p }))
  }

  function handleSave() {
    if (!canWrite) return
    startTransition(async () => {
      const payload: SupplierFormInput = {
        ...form,
        addresses: form.addresses.map((a) => ({
          ...a,
          addressType: 'billing'
        }))
      }
      const result =
        mode === 'edit' && initial
          ? await updateSupplier({ id: initial.id, ...payload })
          : await createSupplier(payload)

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(
        mode === 'edit' ? 'Beszállító mentve.' : 'Beszállító létrehozva.'
      )
      setFieldErrors({})
      router.push(`/beszallitok/${result.id}`)
      router.refresh()
    })
  }

  const title =
    mode === 'edit' ? (initial?.name ?? 'Beszállító') : 'Új beszállító'

  return (
    <div className="pb-14">
      <PageHeader
        title={title}
        description="Beszerzés → Beszállítók"
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/beszallitok')}
            >
              Vissza a listához
            </Button>
            {canWrite ? (
              <Button type="button" loading={pending} onClick={handleSave}>
                Beszállító mentése
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="w-full max-w-6xl space-y-2.5">
        <FormSection
          title="Alap"
          description="Cégnév és elérhetőségek. Mentéshez elég a név."
          columns={4}
        >
          <FormField
            label="Cégnév"
            htmlFor="supplier-name"
            required
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="supplier-name"
              value={form.name}
              disabled={!canWrite}
              onChange={(e) => patch({ name: e.target.value })}
              autoComplete="organization"
            />
          </FormField>

          <FormField
            label="Státusz"
            htmlFor="supplier-status"
            error={fieldErrors.status}
          >
            <MenuSelect
              id="supplier-status"
              value={form.status}
              disabled={!canWrite}
              allowEmpty={false}
              options={(
                Object.keys(SUPPLIER_STATUS_LABEL) as SupplierStatus[]
              ).map((key) => ({
                value: key,
                label: SUPPLIER_STATUS_LABEL[key]
              }))}
              onChange={(v) => patch({ status: v as SupplierStatus })}
            />
          </FormField>

          <FormField
            label="E-mail"
            htmlFor="supplier-email"
            optionalLabel
            error={fieldErrors.email}
          >
            <Input
              id="supplier-email"
              type="email"
              value={form.email}
              disabled={!canWrite}
              onChange={(e) => patch({ email: e.target.value })}
              autoComplete="email"
            />
          </FormField>

          <FormField
            label="Telefonszám"
            htmlFor="supplier-phone"
            optionalLabel
            error={fieldErrors.phone}
            hint={!fieldErrors.phone ? `pl. ${HU_PHONE_EXAMPLE}` : undefined}
          >
            <Input
              id="supplier-phone"
              value={form.phone}
              disabled={!canWrite}
              onChange={(e) =>
                patch({ phone: formatPhoneNumber(e.target.value) })
              }
              inputMode="tel"
              autoComplete="tel"
              placeholder={HU_PHONE_EXAMPLE}
            />
          </FormField>

          <FormField
            label="Weboldal"
            htmlFor="supplier-website"
            optionalLabel
            error={fieldErrors.website}
            className="sm:col-span-2"
          >
            <Input
              id="supplier-website"
              value={form.website}
              disabled={!canWrite}
              onChange={(e) => patch({ website: e.target.value })}
              placeholder="https://pelda.hu"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Adó / cégazonosítók"
          description="Opcionális — számlázáshoz hasznos később."
          columns={4}
        >
          <FormField
            label="Adószám"
            htmlFor="supplier-tax"
            optionalLabel
            error={fieldErrors.taxNumber}
            hint={!fieldErrors.taxNumber ? 'pl. 12345678-1-02' : undefined}
          >
            <Input
              id="supplier-tax"
              value={form.taxNumber}
              disabled={!canWrite}
              onChange={(e) =>
                patch({ taxNumber: formatTaxNumber(e.target.value) })
              }
            />
          </FormField>

          <FormField
            label="Közösségi adószám"
            htmlFor="supplier-eu-vat"
            optionalLabel
            error={fieldErrors.euVatNumber}
            hint={!fieldErrors.euVatNumber ? 'pl. HU12345678' : undefined}
          >
            <Input
              id="supplier-eu-vat"
              value={form.euVatNumber}
              disabled={!canWrite}
              onChange={(e) =>
                patch({ euVatNumber: e.target.value.toUpperCase() })
              }
            />
          </FormField>

          <FormField
            label="Cégjegyzékszám"
            htmlFor="supplier-reg"
            optionalLabel
            error={fieldErrors.companyRegNumber}
            hint={
              !fieldErrors.companyRegNumber ? 'pl. 01-09-123456' : undefined
            }
          >
            <Input
              id="supplier-reg"
              value={form.companyRegNumber}
              disabled={!canWrite}
              onChange={(e) =>
                patch({
                  companyRegNumber: formatCompanyRegNumber(e.target.value)
                })
              }
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Pénzügy defaultok"
          description="Új rendelésnél ezeket ajánljuk fel. Nem kötelező."
          columns={4}
        >
          <FormField
            label="Pénznem"
            htmlFor="supplier-currency"
            error={fieldErrors.defaultCurrency}
          >
            <MenuSelect
              id="supplier-currency"
              value={form.defaultCurrency}
              disabled={!canWrite}
              allowEmpty={false}
              options={SUPPLIER_CURRENCIES.map((c) => ({
                value: c,
                label: c
              }))}
              onChange={(v) =>
                patch({ defaultCurrency: v as SupplierCurrency })
              }
            />
          </FormField>

          <FormField
            label="Alapértelmezett ÁFA"
            htmlFor="supplier-vat"
            optionalLabel
            error={fieldErrors.defaultTaxRateId}
          >
            <MenuSelect
              id="supplier-vat"
              value={form.defaultTaxRateId}
              disabled={!canWrite}
              allowEmpty
              emptyLabel="— Nincs —"
              placeholder="Válassz…"
              options={taxRates.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.rate_percent}%)`
              }))}
              onChange={(v) => patch({ defaultTaxRateId: v })}
            />
          </FormField>

          <FormField
            label="Fizetési mód"
            htmlFor="supplier-pay-method"
            optionalLabel
            error={fieldErrors.defaultPaymentMethodId}
          >
            <MenuSelect
              id="supplier-pay-method"
              value={form.defaultPaymentMethodId}
              disabled={!canWrite}
              allowEmpty
              emptyLabel="— Nincs —"
              placeholder="Válassz…"
              options={paymentMethods.map((m) => ({
                value: m.id,
                label: m.name
              }))}
              onChange={(v) => patch({ defaultPaymentMethodId: v })}
            />
          </FormField>

          <FormField
            label="Fizetési határidő (nap)"
            htmlFor="supplier-terms"
            error={fieldErrors.defaultPaymentTermsDays}
          >
            <Input
              id="supplier-terms"
              type="number"
              min={0}
              max={365}
              value={form.defaultPaymentTermsDays}
              disabled={!canWrite}
              onChange={(e) =>
                patch({
                  defaultPaymentTermsDays: Number(e.target.value) || 0
                })
              }
            />
          </FormField>

          <FormField
            label="IBAN"
            htmlFor="supplier-iban"
            optionalLabel
            error={fieldErrors.iban}
            className="sm:col-span-2"
          >
            <Input
              id="supplier-iban"
              value={form.iban}
              disabled={!canWrite}
              onChange={(e) =>
                patch({ iban: e.target.value.toUpperCase() })
              }
              placeholder="HU42…"
            />
          </FormField>

          <FormField
            label="BIC / SWIFT"
            htmlFor="supplier-bic"
            optionalLabel
            error={fieldErrors.bic}
          >
            <Input
              id="supplier-bic"
              value={form.bic}
              disabled={!canWrite}
              onChange={(e) => patch({ bic: e.target.value.toUpperCase() })}
            />
          </FormField>

          <FormField
            label="Számlatulajdonos"
            htmlFor="supplier-holder"
            optionalLabel
            error={fieldErrors.accountHolder}
          >
            <Input
              id="supplier-holder"
              value={form.accountHolder}
              disabled={!canWrite}
              onChange={(e) => patch({ accountHolder: e.target.value })}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Címek"
          description="Legalább egy alapértelmezett cím ajánlott a rendelés PDF-hez."
          columns={4}
        >
          <div className="col-span-full space-y-2.5">
            {fieldErrors.addresses ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.addresses}
              </p>
            ) : null}

            {form.addresses.map((addr, index) => (
              <div
                key={index}
                className="rounded-md border border-border bg-subtle/40 p-3"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-hint font-medium text-ink">
                    {addr.label.trim() || `Cím ${index + 1}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-hint text-ink-secondary">
                      <input
                        type="radio"
                        name="supplier-default-address"
                        checked={addr.isDefault}
                        disabled={!canWrite}
                        onChange={() => {
                          patch({
                            addresses: form.addresses.map((a, i) => ({
                              ...a,
                              isDefault: i === index
                            }))
                          })
                        }}
                      />
                      Alapértelmezett
                    </label>
                    {canWrite && form.addresses.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink"
                        onClick={() => {
                          const next = form.addresses.filter(
                            (_, i) => i !== index
                          )
                          if (!next.some((a) => a.isDefault) && next[0]) {
                            next[0] = { ...next[0], isDefault: true }
                          }
                          patch({ addresses: next })
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Törlés
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-4">
                  <FormField
                    label="Címke"
                    htmlFor={`addr-label-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`addr-label-${index}`}
                      value={addr.label}
                      disabled={!canWrite}
                      placeholder="pl. Központ"
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            label: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Ország"
                    htmlFor={`addr-country-${index}`}
                    required
                  >
                    <Input
                      id={`addr-country-${index}`}
                      value={addr.country}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            country: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Irányítószám"
                    htmlFor={`addr-zip-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`addr-zip-${index}`}
                      value={addr.postalCode}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            postalCode: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Város"
                    htmlFor={`addr-city-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`addr-city-${index}`}
                      value={addr.city}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            city: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Utca"
                    htmlFor={`addr-street-${index}`}
                    optionalLabel
                    className="sm:col-span-3"
                  >
                    <Input
                      id={`addr-street-${index}`}
                      value={addr.street}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            street: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Házszám"
                    htmlFor={`addr-house-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`addr-house-${index}`}
                      value={addr.houseNumber}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          addresses: updateAddress(form, index, {
                            houseNumber: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                </div>
              </div>
            ))}

            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ink-secondary"
                onClick={() =>
                  patch({
                    addresses: [
                      ...form.addresses,
                      emptyAddressInput(form.addresses.length === 0)
                    ]
                  })
                }
              >
                <Plus className="size-3" aria-hidden />
                Cím
              </Button>
            ) : null}
          </div>
        </FormSection>

        <FormSection
          title="Kapcsolattartók"
          description="Az elsődleges e-mail megy a rendelés küldéséhez (ha van)."
          columns={4}
        >
          <div className="col-span-full space-y-2.5">
            {fieldErrors.contacts ? (
              <p className="text-hint text-danger-ink" role="alert">
                {fieldErrors.contacts}
              </p>
            ) : null}

            {form.contacts.map((contact, index) => (
              <div
                key={index}
                className="rounded-md border border-border bg-subtle/40 p-3"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-hint font-medium text-ink">
                    {contact.name.trim() || `Kapcsolattartó ${index + 1}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-hint text-ink-secondary">
                      <input
                        type="radio"
                        name="supplier-primary-contact"
                        checked={contact.isPrimary}
                        disabled={!canWrite}
                        onChange={() => {
                          patch({
                            contacts: form.contacts.map((c, i) => ({
                              ...c,
                              isPrimary: i === index
                            }))
                          })
                        }}
                      />
                      Elsődleges
                    </label>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger-ink"
                        onClick={() =>
                          patch({
                            contacts: form.contacts.filter(
                              (_, i) => i !== index
                            )
                          })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Törlés
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-4">
                  <FormField
                    label="Név"
                    htmlFor={`contact-name-${index}`}
                    required
                    error={fieldErrors[`contacts.${index}.name`]}
                    className="sm:col-span-2"
                  >
                    <Input
                      id={`contact-name-${index}`}
                      value={contact.name}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          contacts: updateContact(form, index, {
                            name: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="E-mail"
                    htmlFor={`contact-email-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`contact-email-${index}`}
                      type="email"
                      value={contact.email}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          contacts: updateContact(form, index, {
                            email: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Telefon"
                    htmlFor={`contact-phone-${index}`}
                    optionalLabel
                  >
                    <Input
                      id={`contact-phone-${index}`}
                      value={contact.phone}
                      disabled={!canWrite}
                      onChange={(e) =>
                        patch({
                          contacts: updateContact(form, index, {
                            phone: formatPhoneNumber(e.target.value)
                          })
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Megjegyzés"
                    htmlFor={`contact-note-${index}`}
                    optionalLabel
                    className="sm:col-span-4"
                  >
                    <Input
                      id={`contact-note-${index}`}
                      value={contact.note}
                      disabled={!canWrite}
                      placeholder="pl. Logisztika"
                      onChange={(e) =>
                        patch({
                          contacts: updateContact(form, index, {
                            note: e.target.value
                          })
                        })
                      }
                    />
                  </FormField>
                </div>
              </div>
            ))}

            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-ink-secondary"
                onClick={() =>
                  patch({
                    contacts: [
                      ...form.contacts,
                      emptyContactInput(form.contacts.length === 0)
                    ]
                  })
                }
              >
                <Plus className="size-3" aria-hidden />
                Kapcsolattartó
              </Button>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Megjegyzés" columns={4}>
          <FormField
            label="Belső megjegyzés"
            htmlFor="supplier-notes"
            optionalLabel
            error={fieldErrors.notes}
            className="col-span-full"
          >
            <Textarea
              id="supplier-notes"
              value={form.notes}
              disabled={!canWrite}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="pl. Csak webshopon rendelünk, hétfőn szállít."
            />
          </FormField>
        </FormSection>

        {canWrite ? (
          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/beszallitok')}
            >
              Mégse
            </Button>
            <Button type="button" loading={pending} onClick={handleSave}>
              Beszállító mentése
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
