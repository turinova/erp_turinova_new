import { redirect } from 'next/navigation'

import { ph } from '@/lib/platform/platform-href-server'

/** Legacy URL → Katalógus (haladó). */
export default async function PlatformAddonsRedirect() {
  redirect(await ph('/katalogus?advanced=1'))
}
