import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { revalidateStorefrontTenant } from '@/lib/storefront/revalidate'
import { WEBSHOP_ENABLED } from '@/lib/webshop/enabled'

/** Alap termék változásakor (név, ár, kép, törlés) a bolt oldalát is frissíteni kell — ha kint van. */
export async function revalidateShopProduct(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<void> {
  if (!WEBSHOP_ENABLED) return
  const { data } = await supabase
    .from('accessory_web')
    .select('web_slug, sellable_web')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .maybeSingle()
  if (!data) return
  revalidatePath('/webshop')
  revalidatePath('/webshop/katalogus')
  revalidatePath(`/webshop/katalogus/${accessoryId}`)
  if (!data.sellable_web) return
  await revalidateStorefrontTenant(tenantId, { productSlugs: [data.web_slug as string | null] })
}
