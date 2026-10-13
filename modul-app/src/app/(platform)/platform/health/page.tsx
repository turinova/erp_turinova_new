import { redirect } from 'next/navigation'

import { ph } from '@/lib/platform/platform-href-server'

/** Health → Cégek (teendők / ops home). */
export default async function PlatformHealthRedirect() {
  redirect(await ph('/tenants'))
}
