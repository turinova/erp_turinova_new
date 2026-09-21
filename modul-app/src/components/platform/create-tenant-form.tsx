'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPlatformTenant } from '@/lib/platform/actions'
import { slugifyTenantName } from '@/lib/platform/onboarding'

export function CreateTenantForm() {
  const router = useRouter()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [seedTax, setSeedTax] = useState(true)
  const [seedDemoMaster, setSeedDemoMaster] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyTenantName(name))
    }
  }, [name, slugTouched])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await createPlatformTenant({
        name,
        slug,
        ownerEmail,
        ownerPassword,
        seedTaxRates: seedTax,
        seedDemoMaster
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success(result.message ?? 'Cég létrehozva.')
      router.push(`/platform/tenants/${result.tenantId}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-3">
      <FormField label="Cégnév" htmlFor="tenant-name">
        <Input
          id="tenant-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Slug" htmlFor="tenant-slug">
        <Input
          id="tenant-slug"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          required
        />
      </FormField>
      <FormField label="Owner email" htmlFor="tenant-owner-email">
        <Input
          id="tenant-owner-email"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Owner ideiglenes jelszó" htmlFor="tenant-owner-password">
        <Input
          id="tenant-owner-password"
          type="text"
          autoComplete="new-password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
          placeholder="Legalább 8 karakter"
          required
        />
      </FormField>
      <label className="flex items-center gap-2 text-body text-ink">
        <input
          type="checkbox"
          className="size-3.5"
          checked={seedTax}
          onChange={(e) => setSeedTax(e.target.checked)}
        />
        Alap ÁFA kulcsok seedelése
      </label>
      <label className="flex items-start gap-2 text-body text-ink">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5"
          checked={seedDemoMaster}
          onChange={(e) => setSeedDemoMaster(e.target.checked)}
        />
        <span>
          Demó adatok feltöltése
          <span className="mt-0.5 block text-hint text-ink-secondary">
            Cég (Kecskemét + Optinova logo), törzs, HR, tábla / él / szálas /
            termék képekkel.
          </span>
        </span>
      </label>

      {error ? (
        <p className="text-body text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => router.push('/platform/tenants')}
        >
          Mégse
        </Button>
        <Button type="submit" variant="primary" loading={loading}>
          Cég létrehozása
        </Button>
      </div>
    </form>
  )
}
