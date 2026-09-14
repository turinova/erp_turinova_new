import type { Metadata } from 'next'
import Link from 'next/link'

import { CreateTenantForm } from '@/components/platform/create-tenant-form'

export const metadata: Metadata = {
  title: 'Új cég · Platform'
}

export default function PlatformNewTenantPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/platform/tenants"
          className="text-hint text-ink-secondary no-underline hover:underline"
        >
          ← Cégek
        </Link>
        <h1 className="mt-2 text-h1 text-ink">Új cég</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Tenant + owner fiók + teljes oldaljog + onboarding checklist.
        </p>
      </div>
      <CreateTenantForm />
    </div>
  )
}
