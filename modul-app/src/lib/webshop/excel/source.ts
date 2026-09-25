import type { SupabaseClient } from '@supabase/supabase-js'

import { SHOP_IMPORT_MAX_BYTES } from '@/lib/webshop/excel/columns'
import { readShopWorkbook, type ReadResult } from '@/lib/webshop/excel/read'

/** Privát bucket: feltöltött import fájlok + mentés előtti állapotok (`<tenant>/uploads|runs/...`). */
export const IMPORT_BUCKET = 'tenant-imports'

export function safeImportName(name: string): string {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80) || 'import.xlsx'
}

export function uploadPathFor(tenantId: string, filename: string): string {
  return `${tenantId}/uploads/${crypto.randomUUID()}-${safeImportName(filename)}`
}

export function backupPathFor(tenantId: string, runId: string): string {
  return `${tenantId}/runs/${runId}/mentes-elotti-allapot.xlsx`
}

export function isTenantImportPath(tenantId: string, path: string): boolean {
  return path.startsWith(`${tenantId}/`) && !path.includes('..') && path.length <= 400
}

export async function readStoredWorkbook(
  supabase: SupabaseClient,
  tenantId: string,
  path: string,
  name: string
): Promise<ReadResult> {
  if (!isTenantImportPath(tenantId, path)) return { ok: false, message: 'Ismeretlen fájl.' }
  const { data, error } = await supabase.storage.from(IMPORT_BUCKET).download(path)
  if (error || !data) {
    console.error('readStoredWorkbook', path, error?.message)
    return { ok: false, message: 'A feltöltött fájl már nem érhető el. Töltsd fel újra.' }
  }
  if (data.size > SHOP_IMPORT_MAX_BYTES) {
    return { ok: false, message: `A fájl túl nagy (legfeljebb ${Math.round(SHOP_IMPORT_MAX_BYTES / 1024 / 1024)} MB).` }
  }
  return readShopWorkbook(Buffer.from(await data.arrayBuffer()), name)
}
