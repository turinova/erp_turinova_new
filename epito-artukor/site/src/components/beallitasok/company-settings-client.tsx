"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, ImageIcon, Save } from "lucide-react"
import { toast } from "sonner"
import type { OrganizationProfile, OrganizationProfileInput } from "@/types/organization"
import type { QuoteVatMode } from "@/types/projects"
import { QUOTE_VAT_OPTIONS } from "@/lib/quote-client-summary"
import { loadOrganizationProfile } from "@/lib/data/org-store"
import {
  emptyAddress,
  formatHungarianAddress,
  sanitizeRegistrationNumberInput,
  sanitizeTaxNumberInput,
} from "@/lib/organizations/address"
import {
  organizationBankLine,
  organizationContactLine,
  organizationToContractorParty,
} from "@/lib/organization-profile"
import { validateOrganizationProfileInput } from "@/lib/organizations/validate-profile"
import { AddressFields } from "@/components/beallitasok/address-fields"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MAX_LOGO_BYTES = 500_000

type FormState = OrganizationProfileInput

function profileToForm(profile: OrganizationProfile): FormState {
  return {
    legalName: profile.legalName,
    headquarters: { ...profile.headquarters },
    useSeparateMailingAddress: profile.useSeparateMailingAddress,
    mailingAddress: profile.mailingAddress
      ? { ...profile.mailingAddress }
      : { ...emptyAddress() },
    taxNumber: profile.taxNumber,
    registrationNumber: profile.registrationNumber ?? "",
    representative: profile.representative ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    bankName: profile.bankName ?? "",
    bankAccount: profile.bankAccount ?? "",
    logoDataUrl: profile.logoDataUrl,
    defaultVatMode: profile.defaultVatMode,
  }
}

function formToPreviewProfile(form: FormState): OrganizationProfile {
  const base = loadOrganizationProfile()
  return {
    ...base,
    ...form,
    registrationNumber: form.registrationNumber || undefined,
    representative: form.representative || undefined,
    email: form.email || undefined,
    phone: form.phone || undefined,
    bankName: form.bankName || undefined,
    bankAccount: form.bankAccount || undefined,
    mailingAddress: form.useSeparateMailingAddress ? form.mailingAddress : null,
  }
}

export function CompanySettingsClient() {
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(() => profileToForm(loadOrganizationProfile()))
  const [saving, setSaving] = useState(false)

  const loadFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/organization")
      const data = (await res.json()) as { profile?: OrganizationProfile; error?: string }
      if (!res.ok || !data.profile) {
        toast.error(data.error ?? "Nem sikerült betölteni a cégadatokat.")
        setForm(profileToForm(loadOrganizationProfile()))
        return
      }
      setForm(profileToForm(data.profile))
    } catch {
      toast.error("Hálózati hiba — próbáld újra.")
      setForm(profileToForm(loadOrganizationProfile()))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFromApi()
  }, [loadFromApi])

  const previewProfile = useMemo(() => formToPreviewProfile(form), [form])

  const contractorPreview = useMemo(
    () => organizationToContractorParty(previewProfile),
    [previewProfile]
  )
  const bankPreview = useMemo(() => organizationBankLine(previewProfile), [previewProfile])
  const contactPreview = useMemo(() => organizationContactLine(previewProfile), [previewProfile])

  const patch = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleLogoUpload = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Csak képfájl tölthető fel")
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("A logo max. 500 KB lehet")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : undefined
      patch("logoDataUrl", result)
    }
    reader.readAsDataURL(file)
  }

  const buildPayload = (): OrganizationProfileInput => ({
    legalName: form.legalName.trim(),
    headquarters: {
      postalCode: form.headquarters.postalCode.trim(),
      city: form.headquarters.city.trim(),
      street: form.headquarters.street.trim(),
    },
    useSeparateMailingAddress: form.useSeparateMailingAddress,
    mailingAddress: form.useSeparateMailingAddress
      ? {
          postalCode: form.mailingAddress?.postalCode.trim() ?? "",
          city: form.mailingAddress?.city.trim() ?? "",
          street: form.mailingAddress?.street.trim() ?? "",
        }
      : null,
    taxNumber: form.taxNumber.trim(),
    registrationNumber: form.registrationNumber?.trim() || undefined,
    representative: form.representative?.trim() || undefined,
    email: form.email?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    bankName: form.bankName?.trim() || undefined,
    bankAccount: form.bankAccount?.trim() || undefined,
    logoDataUrl: form.logoDataUrl,
    defaultVatMode: form.defaultVatMode,
  })

  const handleSave = async () => {
    const payload = buildPayload()
    const validation = validateOrganizationProfileInput(payload)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { profile?: OrganizationProfile; error?: string }
      if (!res.ok || !data.profile) {
        toast.error(data.error ?? "Mentés sikertelen.")
        return
      }
      setForm(profileToForm(data.profile))
      toast.success("Cégadatok mentve")
    } catch {
      toast.error("Mentés sikertelen")
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveLogo = async () => {
    const payload = buildPayload()
    patch("logoDataUrl", undefined)
    const next = { ...payload, logoDataUrl: undefined }
    const validation = validateOrganizationProfileInput(next)
    if (!validation.ok) {
      toast.error(validation.error)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
      const data = (await res.json()) as { profile?: OrganizationProfile; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Logo törlése sikertelen.")
        return
      }
      if (data.profile) setForm(profileToForm(data.profile))
      toast.success("Logo törölve")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-lg bg-[var(--muted)]" />
  }

  return (
    <>
      <PageHeader
        title="Saját cég"
        description="Cégadatok dokumentumokhoz (TIG, árajánlat)"
        actions={
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Mentés…" : "Mentés"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <section className="ea-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Alapadatok</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="legalName">Cégnév (jogi név)</Label>
                <Input
                  id="legalName"
                  value={form.legalName}
                  onChange={(e) => patch("legalName", e.target.value)}
                  autoComplete="organization"
                />
              </div>

              <AddressFields
                idPrefix="hq"
                label="Székhely"
                value={form.headquarters}
                onChange={(headquarters) => patch("headquarters", headquarters)}
              />

              <div className="flex items-center gap-2">
                <Checkbox
                  id="separate-mail"
                  checked={form.useSeparateMailingAddress}
                  onCheckedChange={(checked) => {
                    const enabled = checked === true
                    patch("useSeparateMailingAddress", enabled)
                    if (enabled && !form.mailingAddress) {
                      patch("mailingAddress", { ...emptyAddress() })
                    }
                  }}
                />
                <Label htmlFor="separate-mail" className="cursor-pointer font-normal">
                  Külön levelezési cím
                </Label>
              </div>

              {form.useSeparateMailingAddress ? (
                <AddressFields
                  idPrefix="mail"
                  label="Levelezési cím"
                  value={form.mailingAddress ?? emptyAddress()}
                  onChange={(mailingAddress) => patch("mailingAddress", mailingAddress)}
                />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tax">Adószám</Label>
                  <Input
                    id="tax"
                    value={form.taxNumber}
                    onChange={(e) => patch("taxNumber", sanitizeTaxNumberInput(e.target.value))}
                    placeholder="12345678-2-42"
                    className="font-code"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-[var(--muted-foreground)]">Formátum: 12345678-1-23</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg">Cégjegyzékszám</Label>
                  <Input
                    id="reg"
                    value={form.registrationNumber ?? ""}
                    onChange={(e) =>
                      patch("registrationNumber", sanitizeRegistrationNumberInput(e.target.value))
                    }
                    placeholder="01-09-123456"
                    className="font-code"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rep">Képviselő (aláíráshoz)</Label>
                <Input
                  id="rep"
                  value={form.representative ?? ""}
                  onChange={(e) => patch("representative", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="ea-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Kapcsolat és bankszámla</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => patch("email", e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={(e) => patch("phone", e.target.value)}
                  placeholder="+36 1 234 5678"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank neve</Label>
                <Input
                  id="bankName"
                  value={form.bankName ?? ""}
                  onChange={(e) => patch("bankName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankAccount">Bankszámlaszám</Label>
                <Input
                  id="bankAccount"
                  value={form.bankAccount ?? ""}
                  onChange={(e) => patch("bankAccount", e.target.value)}
                  placeholder="11773016-12345678-00000000"
                  className="font-code"
                  autoComplete="off"
                />
              </div>
            </div>
          </section>

          <section className="ea-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Logo</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              PNG vagy JPG, max. 500 KB. Megjelenik a TIG és később az árajánlat fejlécében.
            </p>
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)]/40">
                {form.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.logoDataUrl}
                    alt="Cég logo"
                    className="max-h-20 max-w-[9rem] object-contain"
                  />
                ) : (
                  <ImageIcon className="h-8 w-8 text-[var(--sidebar-muted)]" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="logo-upload" className="cursor-pointer">
                  <span className="inline-flex h-9 items-center rounded-md border bg-white px-3 text-sm font-medium hover:bg-[var(--muted)]/40">
                    Fájl kiválasztása
                  </span>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                  />
                </Label>
                {form.logoDataUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveLogo()}
                    disabled={saving}
                  >
                    Logo törlése
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="ea-card p-5">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Alapértelmezett ÁFA</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Új költségvetések és árazatlan ajánlatok ezt öröklik.
            </p>
            <div className="mt-4 max-w-xs">
              <Select
                value={form.defaultVatMode}
                onValueChange={(v) => patch("defaultVatMode", v as QuoteVatMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_VAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="ea-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <Building2 className="h-4 w-4 text-[var(--muted-foreground)]" />
              Előnézet — vállalkozó blokk
            </div>
            {form.logoDataUrl ? (
              <div className="mb-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logoDataUrl}
                  alt=""
                  className="max-h-12 max-w-[10rem] object-contain"
                />
              </div>
            ) : null}
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
              <p className="font-semibold">{contractorPreview.name}</p>
              <p className="mt-1">{contractorPreview.address}</p>
              {form.useSeparateMailingAddress && form.mailingAddress ? (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Levelezés: {formatHungarianAddress(form.mailingAddress)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Adószám: {contractorPreview.taxNumber}
              </p>
              {contractorPreview.registrationNumber ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Cégjegyzékszám: {contractorPreview.registrationNumber}
                </p>
              ) : null}
              {contractorPreview.representative ? (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {contractorPreview.representative}
                </p>
              ) : null}
            </div>
            {contactPreview ? (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">{contactPreview}</p>
            ) : null}
            {bankPreview ? (
              <p className="mt-1 text-xs font-medium">{bankPreview}</p>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  )
}
