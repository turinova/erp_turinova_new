"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  FileText,
  Folder,
  FolderPlus,
  Grid3X3,
  ImageIcon,
  List,
  MoreHorizontal,
  Pencil,
  Search,
  Star,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import type { Project } from "@/types/projects"
import type { ProjectFile, ProjectFileFolderRecord } from "@/types/project-files"
import {
  countFilesInFolder,
  createProjectFileFolder,
  deleteProjectFile,
  deleteProjectFileFolder,
  formatFileSize,
  isImageFile,
  listProjectFileFolders,
  listProjectFiles,
  moveProjectFile,
  renameProjectFileFolder,
  resolveProjectFileUrl,
  setProjectFileCover,
  uploadProjectFile,
} from "@/lib/data/project-files-store"
import {
  formatPhotoDateLabel,
  groupFilesByDate,
  splitFilesByKind,
  type FolderViewMode,
} from "@/lib/project-files-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ProjectFilesTabProps = {
  project: Project
  projectId: string
  tick: number
  onRefresh: () => void
}

export function ProjectFilesTab({ project, projectId, tick, onRefresh }: ProjectFilesTabProps) {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<FolderViewMode>("grid")
  const [groupByDate, setGroupByDate] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renameFolder, setRenameFolder] = useState<ProjectFileFolderRecord | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<ProjectFileFolderRecord | null>(null)
  const [moveFileTarget, setMoveFileTarget] = useState<ProjectFile | null>(null)
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null)
  const [deleteFileTarget, setDeleteFileTarget] = useState<ProjectFile | null>(null)
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map())
  const [uploading, setUploading] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [renameFolderName, setRenameFolderName] = useState("")
  const [moveFolderId, setMoveFolderId] = useState("")
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploadTakenAt, setUploadTakenAt] = useState(new Date().toISOString().slice(0, 10))
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    void tick
    return listProjectFileFolders(projectId)
  }, [projectId, tick])

  const allFiles = useMemo(() => {
    void tick
    return listProjectFiles(projectId, { q: search })
  }, [projectId, search, tick])

  const effectiveFolderId = activeFolderId ?? folders.find((f) => !f.isSystem)?.id ?? folders[0]?.id

  const activeFolder = folders.find((f) => f.id === effectiveFolderId)

  const folderFiles = useMemo(() => {
    if (!effectiveFolderId) return []
    return listProjectFiles(projectId, { folderId: effectiveFolderId, q: search })
  }, [projectId, effectiveFolderId, search, tick])

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of folders) {
      map.set(f.id, countFilesInFolder(projectId, f.id))
    }
    return map
  }, [folders, projectId, tick])

  const { images, documents } = useMemo(() => splitFilesByKind(folderFiles), [folderFiles])
  const photoGroups = useMemo(
    () => (groupByDate ? groupFilesByDate(images) : [{ date: "", files: images }]),
    [images, groupByDate]
  )

  useEffect(() => {
    if (!activeFolderId && folders.length > 0) {
      setActiveFolderId(folders.find((f) => !f.isSystem)?.id ?? folders[0].id)
    }
  }, [activeFolderId, folders])

  const loadUrls = useCallback(async (rows: ProjectFile[]) => {
    const entries = await Promise.all(
      rows.map(async (f) => {
        const url = await resolveProjectFileUrl(f)
        return url ? ([f.id, url] as const) : null
      })
    )
    const next = new Map<string, string>()
    for (const e of entries) {
      if (e) next.set(e[0], e[1])
    }
    setUrlMap(next)
  }, [])

  useEffect(() => {
    loadUrls(allFiles)
    return () => {
      setUrlMap((prev) => {
        for (const url of prev.values()) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url)
        }
        return new Map()
      })
    }
  }, [allFiles, loadUrls])

  const openUpload = () => {
    setUploadFile(null)
    setUploadTitle("")
    setUploadDescription("")
    setUploadTakenAt(new Date().toISOString().slice(0, 10))
    setUploadOpen(true)
  }

  const handleUpload = async () => {
    if (!uploadFile || !effectiveFolderId) {
      toast.error("Válassz fájlt")
      return
    }
    setUploading(true)
    try {
      await uploadProjectFile(projectId, uploadFile, {
        folderId: effectiveFolderId,
        title: uploadTitle || uploadFile.name,
        description: uploadDescription || undefined,
        takenAt: uploadFile.type.startsWith("image/") ? uploadTakenAt : undefined,
      })
      setUploadOpen(false)
      onRefresh()
      toast.success("Fájl feltöltve")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feltöltés sikertelen")
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = () => {
    try {
      const row = createProjectFileFolder({ projectId, name: newFolderName })
      setNewFolderOpen(false)
      setNewFolderName("")
      setActiveFolderId(row.id)
      onRefresh()
      toast.success("Mappa létrehozva")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült létrehozni")
    }
  }

  const handleRenameFolder = () => {
    if (!renameFolder) return
    try {
      renameProjectFileFolder(renameFolder.id, renameFolderName)
      setRenameFolder(null)
      onRefresh()
      toast.success("Mappa átnevezve")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült átnevezni")
    }
  }

  const handleDeleteFolder = () => {
    if (!deleteFolderTarget) return
    try {
      deleteProjectFileFolder(deleteFolderTarget.id)
      if (activeFolderId === deleteFolderTarget.id) {
        setActiveFolderId(folders.find((f) => f.id !== deleteFolderTarget.id && !f.isSystem)?.id ?? null)
      }
      setDeleteFolderTarget(null)
      onRefresh()
      toast.success("Mappa törölve — a fájlok az Egyéb mappába kerültek")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nem sikerült törölni")
    }
  }

  const handleMoveFile = () => {
    if (!moveFileTarget || !moveFolderId) return
    try {
      moveProjectFile(moveFileTarget.id, moveFolderId)
      setMoveFileTarget(null)
      onRefresh()
      toast.success("Fájl áthelyezve")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Áthelyezés sikertelen")
    }
  }

  const handleDeleteFile = async (file: ProjectFile) => {
    await deleteProjectFile(file.id)
    onRefresh()
    toast.success("Törölve")
    if (previewFile?.id === file.id) setPreviewFile(null)
    setDeleteFileTarget(null)
  }

  const handleSetCover = (file: ProjectFile) => {
    setProjectFileCover(projectId, file.id)
    onRefresh()
    toast.success("Projekt borítóképe beállítva")
  }

  const handleDownload = (file: ProjectFile) => {
    const url = urlMap.get(file.id)
    if (!url) {
      toast.error("A fájl nem elérhető")
      return
    }
    const a = document.createElement("a")
    a.href = url
    a.download = file.fileName
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    a.click()
  }

  const userFolders = folders.filter((f) => !f.isSystem)
  const systemFolders = folders.filter((f) => f.isSystem)

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[var(--background)]">
        <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Dokumentumok ({allFiles.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setNewFolderOpen(true)}
            >
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              Új mappa
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={openUpload} disabled={!effectiveFolderId}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Feltöltés ide
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-4 py-1.5 text-xs text-slate-500">
          Válassz mappát bal oldalon — fotó és PDF egyaránt ide kerül. A fájlokat bármikor
          áthelyezheted másik mappába.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-slate-50/80 md:w-52 md:border-b-0 md:border-r">
          <div className="max-h-40 overflow-auto p-2 md:max-h-none">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Mappák
            </p>
            {userFolders.map((folder) => (
              <FolderNavItem
                key={folder.id}
                folder={folder}
                count={folderCounts.get(folder.id) ?? 0}
                active={folder.id === effectiveFolderId}
                onSelect={() => setActiveFolderId(folder.id)}
                onRename={() => {
                  setRenameFolder(folder)
                  setRenameFolderName(folder.name)
                }}
                onDelete={() => setDeleteFolderTarget(folder)}
              />
            ))}
            {systemFolders.length > 0 ? (
              <>
                <p className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Automatikus
                </p>
                {systemFolders.map((folder) => (
                  <FolderNavItem
                    key={folder.id}
                    folder={folder}
                    count={folderCounts.get(folder.id) ?? 0}
                    active={folder.id === effectiveFolderId}
                    onSelect={() => setActiveFolderId(folder.id)}
                    system
                  />
                ))}
              </>
            ) : null}
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Folder className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate text-sm font-semibold text-slate-900">
                {activeFolder?.name ?? "—"}
              </span>
              <span className="text-xs text-slate-500">({folderFiles.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
                title="Rács"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
                title="Lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Keresés…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {folderFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-slate-50 px-6 py-12 text-center">
                <Folder className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-800">
                  {search ? "Nincs találat" : `A „${activeFolder?.name}” mappa üres`}
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  {search
                    ? "Próbálj másik keresőszót."
                    : "Fotó, PDF, Word — bármi ide tölthető. Egy gomb, nincs típusválasztás."}
                </p>
                {!search ? (
                  <Button size="sm" className="mt-4" onClick={openUpload}>
                    <Upload className="mr-2 h-4 w-4" />
                    Feltöltés ebbe a mappába
                  </Button>
                ) : null}
              </div>
            ) : viewMode === "grid" ? (
              <div className="space-y-4">
                {images.length > 0 ? (
                  <div className="space-y-3">
                    {photoGroups.map(({ date, files: groupFiles }) => (
                      <div key={date || "all"}>
                        {groupByDate && date ? (
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-slate-500">
                              {formatPhotoDateLabel(date)}
                            </p>
                            <button
                              type="button"
                              className="text-[10px] text-slate-400 hover:text-slate-600"
                              onClick={() => setGroupByDate(false)}
                            >
                              Összes egyben
                            </button>
                          </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {groupFiles.map((file) => (
                            <FileTile
                              key={file.id}
                              file={file}
                              url={urlMap.get(file.id)}
                              onPreview={() => setPreviewFile(file)}
                              onDelete={() => setDeleteFileTarget(file)}
                              onSetCover={() => handleSetCover(file)}
                              onDownload={() => handleDownload(file)}
                              onMove={() => {
                                setMoveFileTarget(file)
                                setMoveFolderId(
                                  folders.find((f) => f.id !== file.folderId)?.id ?? ""
                                )
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {documents.length > 0 ? (
                  <div className="divide-y rounded-lg border bg-white">
                    {documents.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        url={urlMap.get(file.id)}
                        onPreview={() => setPreviewFile(file)}
                        onDelete={() => setDeleteFileTarget(file)}
                        onDownload={() => handleDownload(file)}
                        onMove={() => {
                          setMoveFileTarget(file)
                          setMoveFolderId(folders.find((f) => f.id !== file.folderId)?.id ?? "")
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="divide-y rounded-lg border bg-white">
                {folderFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    url={urlMap.get(file.id)}
                    onPreview={() => setPreviewFile(file)}
                    onDelete={() => setDeleteFileTarget(file)}
                    onDownload={() => handleDownload(file)}
                    onMove={() => {
                      setMoveFileTarget(file)
                      setMoveFolderId(folders.find((f) => f.id !== file.folderId)?.id ?? "")
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Upload */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Feltöltés — {activeFolder?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fájl (fotó, PDF, Word…)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setUploadFile(file)
                  if (file && !uploadTitle) {
                    setUploadTitle(file.name.replace(/\.[^.]+$/, ""))
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadFile ? uploadFile.name : "Fájl kiválasztása…"}
              </Button>
              {uploadFile ? (
                <p className="text-xs text-slate-500">{formatFileSize(uploadFile.size)}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Megnevezés</Label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="pl. Showroom bejárat"
              />
            </div>
            {uploadFile?.type.startsWith("image/") ? (
              <div className="space-y-2">
                <Label>Fotó készült</Label>
                <Input
                  type="date"
                  value={uploadTakenAt}
                  onChange={(e) => setUploadTakenAt(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Megjegyzés (opcionális)</Label>
              <Textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? "Feltöltés…" : "Feltöltés"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Új mappa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Mappa neve</Label>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="pl. Felmérés 2026. március"
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Létrehozás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename folder */}
      <Dialog open={!!renameFolder} onOpenChange={(o) => !o && setRenameFolder(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mappa átnevezése</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Új név</Label>
            <Input
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolder(null)}>
              Mégse
            </Button>
            <Button onClick={handleRenameFolder} disabled={!renameFolderName.trim()}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move file */}
      <Dialog open={!!moveFileTarget} onOpenChange={(o) => !o && setMoveFileTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Áthelyezés mappába</DialogTitle>
          </DialogHeader>
          {moveFileTarget ? (
            <p className="text-sm text-slate-600">
              <strong>{moveFileTarget.title}</strong>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label>Cél mappa</Label>
            <Select value={moveFolderId} onValueChange={setMoveFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz mappát…" />
              </SelectTrigger>
              <SelectContent>
                {folders
                  .filter((f) => f.id !== moveFileTarget?.folderId)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveFileTarget(null)}>
              Mégse
            </Button>
            <Button onClick={handleMoveFile} disabled={!moveFolderId}>
              Áthelyezés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
        <DialogContent className="max-w-3xl">
          {previewFile ? (
            <>
              <DialogHeader>
                <DialogTitle>{previewFile.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {isImageFile(previewFile) && urlMap.get(previewFile.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urlMap.get(previewFile.id)}
                    alt={previewFile.title}
                    className="max-h-[55vh] w-full rounded-lg bg-slate-100 object-contain"
                  />
                ) : previewFile.mimeType === "application/pdf" && urlMap.get(previewFile.id) ? (
                  <iframe
                    title={previewFile.title}
                    src={urlMap.get(previewFile.id)}
                    className="h-[55vh] w-full rounded-lg border bg-slate-100"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg bg-slate-50 py-12">
                    <FileText className="h-12 w-12 text-slate-400" />
                    <p className="text-sm text-slate-600">{previewFile.fileName}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMoveFileTarget(previewFile)
                    setMoveFolderId(folders.find((f) => f.id !== previewFile.folderId)?.id ?? "")
                  }}
                >
                  Áthelyezés…
                </Button>
                {isImageFile(previewFile) ? (
                  <Button variant="outline" onClick={() => handleSetCover(previewFile)}>
                    <Star className="mr-2 h-4 w-4" />
                    Borítókép
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => handleDownload(previewFile)}>
                  <Download className="mr-2 h-4 w-4" />
                  Letöltés
                </Button>
                <Button variant="destructive" onClick={() => setDeleteFileTarget(previewFile)}>
                  Törlés
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteFileTarget}
        onOpenChange={(o) => !o && setDeleteFileTarget(null)}
        title="Fájl törlése"
        description={
          deleteFileTarget ? (
            <p>
              Biztosan törlöd: <strong>{deleteFileTarget.title}</strong>?
            </p>
          ) : null
        }
        confirmLabel="Igen, törlöm"
        destructive
        onConfirm={() => deleteFileTarget && void handleDeleteFile(deleteFileTarget)}
      />

      <ConfirmDialog
        open={!!deleteFolderTarget}
        onOpenChange={(o) => !o && setDeleteFolderTarget(null)}
        title="Mappa törlése"
        description={
          deleteFolderTarget ? (
            <p>
              A <strong>{deleteFolderTarget.name}</strong> mappa törlődik. A benne lévő fájlok az
              Egyéb mappába kerülnek.
            </p>
          ) : null
        }
        confirmLabel="Igen, törlöm"
        destructive
        onConfirm={handleDeleteFolder}
      />
    </div>
  )
}

function FolderNavItem({
  folder,
  count,
  active,
  system,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: ProjectFileFolderRecord
  count: number
  active: boolean
  system?: boolean
  onSelect: () => void
  onRename?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md",
        active ? "bg-blue-50" : "hover:bg-slate-100"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm",
          active ? "font-semibold text-blue-800" : "text-slate-700"
        )}
      >
        <Folder className={cn("h-4 w-4 shrink-0", system && "text-slate-400")} />
        <span className="truncate">{folder.name}</span>
        <span className="ml-auto shrink-0 tabular-nums text-xs text-slate-400">{count}</span>
      </button>
      {!system && (onRename || onDelete) ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mr-1 rounded p-1 text-slate-400 opacity-0 hover:bg-white group-hover:opacity-100"
              aria-label="Mappa műveletek"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem] p-1">
            {onRename ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-slate-100"
                onClick={onRename}
              >
                <Pencil className="h-4 w-4" />
                Átnevezés
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Törlés
              </button>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function FileTile({
  file,
  url,
  onPreview,
  onDelete,
  onSetCover,
  onDownload,
  onMove,
}: {
  file: ProjectFile
  url?: string
  onPreview: () => void
  onDelete: () => void
  onSetCover: () => void
  onDownload: () => void
  onMove: () => void
}) {
  return (
    <article className="overflow-hidden rounded-md border bg-white">
      <button type="button" onClick={onPreview} className="relative block w-full">
        <div className="aspect-square bg-slate-100">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
          {file.isCover ? (
            <Badge className="absolute left-1 top-1 px-1 py-0 text-[9px]">Borító</Badge>
          ) : null}
        </div>
      </button>
      <div className="space-y-1 p-1.5">
        <p className="truncate text-[11px] font-medium text-slate-800" title={file.title}>
          {file.title}
        </p>
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            onClick={onMove}
            className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-700"
            title="Áthelyezés"
          >
            <Folder className="h-3.5 w-3.5" />
          </button>
          {!file.isCover ? (
            <button
              type="button"
              onClick={onSetCover}
              className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
              title="Borítókép"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDownload}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Letöltés"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Törlés"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

function FileRow({
  file,
  url,
  onPreview,
  onDelete,
  onDownload,
  onMove,
}: {
  file: ProjectFile
  url?: string
  onPreview: () => void
  onDelete: () => void
  onDownload: () => void
  onMove: () => void
}) {
  const isPdf = file.mimeType === "application/pdf"
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
        {isImageFile(file) && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4 text-slate-500" />
        )}
      </div>
      <button type="button" onClick={onPreview} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-900">{file.title}</p>
        <p className="text-[11px] text-slate-500">{formatFileSize(file.sizeBytes)}</p>
      </button>
      <div className="flex shrink-0 gap-0.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onMove} title="Áthelyezés">
          <Folder className="h-4 w-4" />
        </Button>
        {isPdf && url ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              Megnyitás
            </a>
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDownload} title="Letöltés">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete} title="Törlés">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  )
}
