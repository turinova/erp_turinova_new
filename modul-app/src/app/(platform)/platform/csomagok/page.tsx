import { redirect } from 'next/navigation'

import { ph } from '@/lib/platform/platform-href-server'

/** Legacy URL → Katalógus. */
export default async function PlatformPlansRedirect() {
  redirect(await ph('/katalogus'))
}
