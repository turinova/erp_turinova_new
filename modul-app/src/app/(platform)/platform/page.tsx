import { redirect } from 'next/navigation'

import { ph } from '@/lib/platform/platform-href-server'

/** Lean ops: Áttekintés → Cégek (Teendők a lista tetején). */
export default async function PlatformHomeRedirect() {
  redirect(await ph('/tenants'))
}
