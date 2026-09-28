import { cache } from 'react'

import { getStorefrontShell } from '@/lib/storefront/shell'
import { loadLegalContext } from '@/lib/webshop/legal/context'

/** Bolt jogi kontextusa kérésenként egyszer (a shell adataira építve). */
export const getStorefrontLegal = cache(async (site: string) => {
  const shell = await getStorefrontShell(site)
  if (!shell) return null
  const { ctx } = await loadLegalContext(shell.admin, shell.tenant.id, {
    name: shell.tenant.name,
    url: shell.tenant.base.origin
  })
  return { shell, ctx }
})

export function formatLegalDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', dateStyle: 'long' }).format(new Date(iso))
}
