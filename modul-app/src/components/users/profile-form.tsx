'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/patterns/form-field'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateOwnDisplayName } from '@/lib/users/actions'

type ProfileFormProps = {
  email: string
  initialDisplayName: string
}

export function ProfileForm({ email, initialDisplayName }: ProfileFormProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    try {
      const result = await updateOwnDisplayName({ displayName })
      if (!result.ok) {
        setError(result.message)
        return
      }
      toast.success('Név mentve.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Saját adatok"
        description="A megjelenített név látszik a felhasználólistán és a felső sávban."
      />

      <div className="max-w-md space-y-3">
        <FormField label="Email" htmlFor="profile-email">
          <Input
            id="profile-email"
            type="email"
            value={email}
            disabled
            readOnly
          />
        </FormField>
        <FormField label="Megjelenített név" htmlFor="profile-name">
          <Input
            id="profile-name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Pl. Kovács Anna"
          />
        </FormField>
        {error ? (
          <p className="text-body text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            loading={loading}
            onClick={() => void handleSave()}
          >
            Mentés
          </Button>
        </div>
      </div>
    </div>
  )
}
