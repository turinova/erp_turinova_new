import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ProfileForm } from '@/components/users/profile-form'
import { getSessionUser } from '@/lib/auth/session'
import { getOwnProfile } from '@/lib/users/actions'

export const metadata: Metadata = {
  title: 'Saját adatok'
}

export default async function ProfilPage() {
  const user = await getSessionUser()
  if (!user?.hasMembership) {
    redirect('/no-access')
  }

  const profile = await getOwnProfile()

  if (profile.error) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Saját adatok</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {profile.error}
        </p>
      </div>
    )
  }

  return (
    <ProfileForm
      email={profile.email}
      initialDisplayName={profile.displayName}
    />
  )
}
