import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { MarketingHomePage } from '@/components/marketing/home-page'
import {
  normalizeHostname,
  resolveAuthSurface
} from '@/lib/auth/surface'

export default async function RootPage() {
  const host = (await headers()).get('host')
  const surface = resolveAuthSurface(normalizeHostname(host))

  if (surface === 'partner') {
    return <MarketingHomePage />
  }

  // Platform (admin.): middleware rewrites `/` → `/platform` — this page
  // should not run there. Staff / localhost → tenant home.
  redirect('/home')
}
