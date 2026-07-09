import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProjectFile, ProjectFileFolderRecord } from "@/types/project-files"

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapFolderRow(row: any): ProjectFileFolderRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    orgId: row.organization_id,
    name: row.name,
    sortOrder: row.sort_order,
    isSystem: row.is_system,
    createdAt: row.created_at,
  }
}

export function mapFileRow(row: any): ProjectFile {
  return {
    id: row.id,
    projectId: row.project_id,
    orgId: row.organization_id,
    folderId: row.folder_id ?? "",
    category: row.category,
    title: row.title,
    description: row.description ?? undefined,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    storageKey: row.storage_key,
    quoteId: row.quote_id ?? undefined,
    rfqPackageId: row.rfq_id ?? undefined,
    takenAt: row.taken_at ?? undefined,
    isCover: row.is_cover || undefined,
    uploadedAt: row.uploaded_at,
    sortOrder: row.sort_order,
  }
}

export function folderToRow(f: ProjectFileFolderRecord, orgId: string): Record<string, unknown> {
  return {
    id: f.id,
    project_id: f.projectId,
    organization_id: orgId,
    name: f.name,
    sort_order: f.sortOrder,
    is_system: f.isSystem ?? false,
    created_at: f.createdAt,
  }
}

export function fileToRow(f: ProjectFile, orgId: string): Record<string, unknown> {
  return {
    id: f.id,
    project_id: f.projectId,
    organization_id: orgId,
    folder_id: f.folderId || null,
    category: f.category,
    title: f.title,
    description: f.description ?? null,
    file_name: f.fileName,
    mime_type: f.mimeType,
    size_bytes: f.sizeBytes,
    storage_key: f.storageKey,
    quote_id: f.quoteId ?? null,
    rfq_id: f.rfqPackageId ?? null,
    taken_at: f.takenAt ? f.takenAt.slice(0, 10) : null,
    is_cover: f.isCover ?? false,
    sort_order: f.sortOrder,
    uploaded_at: f.uploadedAt,
  }
}

export async function loadProjectFilesState(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ folders: ProjectFileFolderRecord[]; files: ProjectFile[] }> {
  const [foldersRes, filesRes] = await Promise.all([
    supabase
      .from("project_folders")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order"),
    supabase
      .from("project_files")
      .select("*")
      .eq("organization_id", orgId)
      .order("sort_order"),
  ])
  if (foldersRes.error) throw new Error(`project_folders: ${foldersRes.error.message}`)
  if (filesRes.error) throw new Error(`project_files: ${filesRes.error.message}`)

  return {
    folders: (foldersRes.data ?? []).map(mapFolderRow),
    files: (filesRes.data ?? []).map(mapFileRow),
  }
}

/**
 * Metaadat-szinkron: upsert + hiányzók törlése. A fájltartalom (Storage)
 * feltöltése/törlése külön végponton történik — itt csak a sorok mozognak.
 */
export async function syncProjectFilesState(
  supabase: SupabaseClient,
  orgId: string,
  input: { folders: ProjectFileFolderRecord[]; files: ProjectFile[] }
): Promise<void> {
  const existing = await loadProjectFilesState(supabase, orgId)

  const keepFolderIds = new Set(input.folders.map((f) => f.id))
  const keepFileIds = new Set(input.files.map((f) => f.id))

  if (input.folders.length > 0) {
    const { error } = await supabase
      .from("project_folders")
      .upsert(input.folders.map((f) => folderToRow(f, orgId)), { onConflict: "id" })
    if (error) throw new Error(`project_folders upsert: ${error.message}`)
  }
  if (input.files.length > 0) {
    const { error } = await supabase
      .from("project_files")
      .upsert(input.files.map((f) => fileToRow(f, orgId)), { onConflict: "id" })
    if (error) throw new Error(`project_files upsert: ${error.message}`)
  }

  const filesToDelete = existing.files.filter((f) => !keepFileIds.has(f.id))
  if (filesToDelete.length > 0) {
    const storagePaths = filesToDelete
      .filter((f) => f.storageKey.startsWith("storage:"))
      .map((f) => f.storageKey.slice("storage:".length))
    if (storagePaths.length > 0) {
      await supabase.storage.from("project-files").remove(storagePaths)
    }
    const { error } = await supabase
      .from("project_files")
      .delete()
      .in("id", filesToDelete.map((f) => f.id))
    if (error) throw new Error(`project_files delete: ${error.message}`)
  }

  const foldersToDelete = existing.folders.filter((f) => !keepFolderIds.has(f.id))
  if (foldersToDelete.length > 0) {
    const { error } = await supabase
      .from("project_folders")
      .delete()
      .in("id", foldersToDelete.map((f) => f.id))
    if (error) throw new Error(`project_folders delete: ${error.message}`)
  }
}
