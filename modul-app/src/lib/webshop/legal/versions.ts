/**
 * Jogi dokumentumok változatai: a bolt élőben generál, de minden eltérő tartalom új, megőrzött
 * változat (verzió + dátum). A rendeléskor hatályos ÁSZF így utólag is visszakereshető.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { LEGAL_TEMPLATE_VERSION } from '@/lib/webshop/legal/constants'
import { loadLegalContext } from '@/lib/webshop/legal/context'
import { hashDoc, renderLegalDoc } from '@/lib/webshop/legal/render'
import { LEGAL_DOC_KINDS, type LegalDoc, type LegalDocKind } from '@/lib/webshop/legal/types'

export type LegalVersionMeta = { version: number; createdAt: string }

function missingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

export async function latestLegalVersion(
  admin: SupabaseClient,
  tenantId: string,
  kind: LegalDocKind
): Promise<(LegalVersionMeta & { hash: string }) | null> {
  const { data, error } = await admin
    .from('webshop_legal_versions')
    .select('version, content_hash, created_at')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (!missingTable(error.code)) console.error('latestLegalVersion', error.message)
    return null
  }
  if (!data) return null
  return {
    version: Number(data.version),
    hash: String(data.content_hash),
    createdAt: String(data.created_at)
  }
}

/** Új változatot ír, ha a tartalom eltér a legutóbbitól. Service role kliens kell. */
export async function ensureLegalVersion(
  admin: SupabaseClient,
  tenantId: string,
  doc: LegalDoc
): Promise<LegalVersionMeta | null> {
  const hash = hashDoc(doc)
  const latest = await latestLegalVersion(admin, tenantId, doc.kind)
  if (latest?.hash === hash) return latest
  const version = (latest?.version ?? 0) + 1
  const { data, error } = await admin
    .from('webshop_legal_versions')
    .insert({
      tenant_id: tenantId,
      kind: doc.kind,
      version,
      content_hash: hash,
      template_version: LEGAL_TEMPLATE_VERSION,
      body: doc
    })
    .select('version, created_at')
    .single()
  if (error) {
    // 23505: párhuzamos kérés már beírta ugyanezt a verziót.
    if (error.code === '23505') {
      const again = await latestLegalVersion(admin, tenantId, doc.kind)
      return again
    }
    if (!missingTable(error.code)) console.error('ensureLegalVersion', error.message)
    return null
  }
  return { version: Number(data.version), createdAt: String(data.created_at) }
}

export async function listLegalVersions(
  admin: SupabaseClient,
  tenantId: string,
  kind: LegalDocKind,
  limit = 25
): Promise<LegalVersionMeta[]> {
  const { data, error } = await admin
    .from('webshop_legal_versions')
    .select('version, created_at')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .order('version', { ascending: false })
    .limit(limit)
  if (error) {
    if (!missingTable(error.code)) console.error('listLegalVersions', error.message)
    return []
  }
  return (data ?? []).map((r) => ({ version: Number(r.version), createdAt: String(r.created_at) }))
}

export async function getLegalVersion(
  admin: SupabaseClient,
  tenantId: string,
  kind: LegalDocKind,
  version: number
): Promise<(LegalVersionMeta & { doc: LegalDoc }) | null> {
  const { data, error } = await admin
    .from('webshop_legal_versions')
    .select('version, created_at, body')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .eq('version', version)
    .maybeSingle()
  if (error) {
    if (!missingTable(error.code)) console.error('getLegalVersion', error.message)
    return null
  }
  if (!data) return null
  return {
    version: Number(data.version),
    createdAt: String(data.created_at),
    doc: data.body as LegalDoc
  }
}

/** Beállításmentés után: minden dokumentum aktuális változatának rögzítése. */
export async function syncAllLegalVersions(admin: SupabaseClient, tenantId: string): Promise<void> {
  const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
  const slug = (data?.slug as string | undefined) ?? null
  if (!slug) return
  const tenant = await resolveStorefrontTenant(admin, slug)
  if (!tenant) return
  const { ctx } = await loadLegalContext(admin, tenant.id, { name: tenant.name, url: tenant.base.origin })
  for (const kind of LEGAL_DOC_KINDS) {
    await ensureLegalVersion(admin, tenant.id, renderLegalDoc(kind, ctx))
  }
}
