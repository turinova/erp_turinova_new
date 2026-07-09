import type {
  ProjectFile,
  ProjectFileFilters,
  ProjectFileFolderInput,
  ProjectFileFolderRecord,
} from "@/types/project-files"
import { defaultFolderSpecs, inferCategoryFromFile } from "@/lib/project-file-folders"
import { recordProjectAudit } from "@/lib/data/projects-store"

/**
 * Projekt-fájlok — a Supabase az egyetlen forrás (project_folders /
 * project_files táblák + project-files Storage bucket). A kliens in-memory
 * cache-t használ, amelyet a syncProjectFilesFromServer() tölt fel; a
 * metaadat-mutációk a teljes állapotot visszaszinkronizálják (PUT), a
 * fájltartalom külön upload/delete végponton megy.
 */

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

let foldersCache: ProjectFileFolderRecord[] = []
let filesCache: ProjectFile[] = []

function newId(): string {
  return crypto.randomUUID()
}

export async function syncProjectFilesFromServer(): Promise<boolean> {
  if (typeof window === "undefined") return false
  try {
    const res = await fetch("/api/project-files")
    if (!res.ok) return false
    const data = (await res.json()) as {
      folders: ProjectFileFolderRecord[]
      files: ProjectFile[]
    }
    foldersCache = data.folders ?? []
    filesCache = data.files ?? []
    return true
  } catch {
    return false
  }
}

function pushStateToServer(): void {
  void fetch("/api/project-files", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folders: foldersCache, files: filesCache }),
  }).catch(() => {
    /* offline */
  })
}

export function loadProjectFileFoldersMeta(): ProjectFileFolderRecord[] {
  return foldersCache
}

function saveProjectFileFoldersMeta(folders: ProjectFileFolderRecord[]): void {
  foldersCache = folders
  pushStateToServer()
}

export function loadProjectFilesMeta(): ProjectFile[] {
  return filesCache
}

function saveProjectFilesMeta(files: ProjectFile[]): void {
  filesCache = files
  pushStateToServer()
}

function findFolderByName(
  folders: ProjectFileFolderRecord[],
  projectId: string,
  name: string
): ProjectFileFolderRecord | undefined {
  return folders.find((f) => f.projectId === projectId && f.name === name)
}

function createDefaultFoldersForProject(
  projectId: string,
  orgId: string
): ProjectFileFolderRecord[] {
  const now = new Date().toISOString()
  return defaultFolderSpecs().map((spec, index) => ({
    id: newId(),
    projectId,
    orgId,
    name: spec.name,
    sortOrder: spec.isSystem ? 99 : index + 1,
    isSystem: spec.isSystem,
    createdAt: now,
  }))
}

/** Alapértelmezett mappák biztosítása egy projekthez */
export function ensureProjectFileStructure(projectId: string): void {
  if (!foldersCache.some((f) => f.projectId === projectId)) {
    const orgId =
      filesCache.find((f) => f.projectId === projectId)?.orgId ??
      foldersCache[0]?.orgId ??
      ""
    saveProjectFileFoldersMeta([
      ...foldersCache,
      ...createDefaultFoldersForProject(projectId, orgId),
    ])
  }
}

export function listProjectFileFolders(projectId: string): ProjectFileFolderRecord[] {
  ensureProjectFileStructure(projectId)
  return loadProjectFileFoldersMeta()
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "hu"))
}

export function getProjectFileFolder(id: string): ProjectFileFolderRecord | undefined {
  return loadProjectFileFoldersMeta().find((f) => f.id === id)
}

export function countFilesInFolder(projectId: string, folderId: string): number {
  return loadProjectFilesMeta().filter(
    (f) => f.projectId === projectId && f.folderId === folderId
  ).length
}

export function createProjectFileFolder(input: ProjectFileFolderInput): ProjectFileFolderRecord {
  ensureProjectFileStructure(input.projectId)
  const folders = loadProjectFileFoldersMeta()
  const name = input.name.trim()
  if (!name) throw new Error("A mappa neve kötelező")

  if (findFolderByName(folders, input.projectId, name)) {
    throw new Error("Ilyen nevű mappa már van")
  }

  const projectFolders = folders.filter((f) => f.projectId === input.projectId)
  const row: ProjectFileFolderRecord = {
    id: newId(),
    projectId: input.projectId,
    orgId: input.orgId ?? projectFolders[0]?.orgId ?? "",
    name,
    sortOrder: input.sortOrder ?? projectFolders.filter((f) => !f.isSystem).length + 1,
    isSystem: input.isSystem,
    createdAt: new Date().toISOString(),
  }
  saveProjectFileFoldersMeta([...folders, row])
  return row
}

export function renameProjectFileFolder(folderId: string, name: string): ProjectFileFolderRecord {
  const folders = [...loadProjectFileFoldersMeta()]
  const idx = folders.findIndex((f) => f.id === folderId)
  if (idx < 0) throw new Error("A mappa nem található")
  if (folders[idx].isSystem) throw new Error("A rendszer mappa nem nevezhető át")

  const trimmed = name.trim()
  if (!trimmed) throw new Error("A mappa neve kötelező")
  if (
    folders.some(
      (f) =>
        f.projectId === folders[idx].projectId &&
        f.id !== folderId &&
        f.name.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    throw new Error("Ilyen nevű mappa már van")
  }

  folders[idx] = { ...folders[idx], name: trimmed }
  saveProjectFileFoldersMeta(folders)
  return folders[idx]
}

export function deleteProjectFileFolder(folderId: string): boolean {
  const folders = loadProjectFileFoldersMeta()
  const folder = folders.find((f) => f.id === folderId)
  if (!folder) return false
  if (folder.isSystem) throw new Error("A rendszer mappa nem törölhető")

  const files = loadProjectFilesMeta()
  const otherFolder =
    findFolderByName(folders, folder.projectId, defaultFolderSpecs()[3].name) ??
    folders.find((f) => f.projectId === folder.projectId && !f.isSystem && f.id !== folderId)

  filesCache = files.map((f) =>
    f.folderId === folderId && otherFolder ? { ...f, folderId: otherFolder.id } : f
  )
  foldersCache = folders.filter((f) => f.id !== folderId)
  pushStateToServer()
  return true
}

export function moveProjectFile(fileId: string, folderId: string): ProjectFile {
  const files = [...loadProjectFilesMeta()]
  const idx = files.findIndex((f) => f.id === fileId)
  if (idx < 0) throw new Error("A fájl nem található")

  const folder = getProjectFileFolder(folderId)
  if (!folder) throw new Error("A mappa nem található")
  if (folder.projectId !== files[idx].projectId) {
    throw new Error("A fájl és a mappa nem ugyanahhoz a projekthez tartozik")
  }

  files[idx] = { ...files[idx], folderId }
  saveProjectFilesMeta(files)
  return files[idx]
}

export function listProjectFiles(
  projectId: string,
  filters: ProjectFileFilters = {}
): ProjectFile[] {
  ensureProjectFileStructure(projectId)
  let rows = loadProjectFilesMeta().filter((f) => f.projectId === projectId)

  if (filters.folderId && filters.folderId !== "all") {
    rows = rows.filter((f) => f.folderId === filters.folderId)
  }
  if (filters.category && filters.category !== "all") {
    rows = rows.filter((f) => f.category === filters.category)
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    )
  }

  return rows.sort((a, b) => a.sortOrder - b.sortOrder || b.uploadedAt.localeCompare(a.uploadedAt))
}

export function getProjectFile(id: string): ProjectFile | undefined {
  return loadProjectFilesMeta().find((f) => f.id === id)
}

export function getProjectCoverFile(projectId: string): ProjectFile | undefined {
  const files = listProjectFiles(projectId)
  return files.find((f) => f.isCover) ?? files.find((f) => f.mimeType.startsWith("image/"))
}

export async function resolveProjectFileUrl(file: ProjectFile): Promise<string | null> {
  if (file.storageKey.startsWith("url:")) {
    return file.storageKey.slice(4)
  }
  if (file.storageKey.startsWith("storage:")) {
    try {
      const res = await fetch(`/api/project-files/${file.id}`)
      if (!res.ok) return null
      const data = (await res.json()) as { url?: string }
      return data.url ?? null
    } catch {
      return null
    }
  }
  return null
}

export function isImageFile(file: ProjectFile): boolean {
  return file.mimeType.startsWith("image/")
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function uploadProjectFile(
  projectId: string,
  file: File,
  input: {
    folderId: string
    title: string
    description?: string
    takenAt?: string
    quoteId?: string
  }
): Promise<ProjectFile> {
  ensureProjectFileStructure(projectId)
  const folder = getProjectFileFolder(input.folderId)
  if (!folder || folder.projectId !== projectId) {
    throw new Error("Érvénytelen mappa")
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Maximális méret: ${formatFileSize(MAX_UPLOAD_BYTES)}`)
  }

  const category = inferCategoryFromFile(file)
  const form = new FormData()
  form.set("file", file)
  form.set("projectId", projectId)
  form.set("folderId", input.folderId)
  form.set("category", category)
  form.set("title", input.title.trim() || file.name)
  if (input.description?.trim()) form.set("description", input.description.trim())
  const takenAt =
    input.takenAt ||
    (category === "site_photo" ? new Date().toISOString().slice(0, 10) : "")
  if (takenAt) form.set("takenAt", takenAt)
  if (input.quoteId) form.set("quoteId", input.quoteId)
  form.set(
    "sortOrder",
    String(filesCache.filter((f) => f.projectId === projectId).length + 1)
  )

  const res = await fetch("/api/project-files/upload", { method: "POST", body: form })
  const data = (await res.json()) as { file?: ProjectFile; error?: string }
  if (!res.ok || !data.file) {
    throw new Error(data.error ?? "A feltöltés sikertelen")
  }

  filesCache = [...filesCache, data.file]
  recordProjectAudit(projectId, {
    kind: "file",
    action: "Dokumentum feltöltve",
    context: data.file.title,
  })
  return data.file
}

export async function deleteProjectFile(id: string): Promise<boolean> {
  const file = filesCache.find((f) => f.id === id)
  if (!file) return false

  try {
    const res = await fetch(`/api/project-files/${id}`, { method: "DELETE" })
    if (!res.ok && res.status !== 404) return false
  } catch {
    return false
  }

  filesCache = filesCache.filter((f) => f.id !== id)
  return true
}

export function setProjectFileCover(projectId: string, fileId: string): void {
  saveProjectFilesMeta(
    filesCache.map((f) => {
      if (f.projectId !== projectId) return f
      return { ...f, isCover: f.id === fileId }
    })
  )
}
