import type { ProjectFile } from "@/types/project-files"
import { formatPhotoDateLabel } from "@/lib/project-file-folders"

export type FolderViewMode = "grid" | "list"

export function groupFilesByDate(files: ProjectFile[]): { date: string; files: ProjectFile[] }[] {
  const map = new Map<string, ProjectFile[]>()
  for (const file of files) {
    const key = file.takenAt ?? file.uploadedAt.slice(0, 10)
    const list = map.get(key) ?? []
    list.push(file)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, groupFiles]) => ({ date, files: groupFiles }))
}

export { formatPhotoDateLabel }

export function splitFilesByKind(files: ProjectFile[]): {
  images: ProjectFile[]
  documents: ProjectFile[]
} {
  const images: ProjectFile[] = []
  const documents: ProjectFile[] = []
  for (const file of files) {
    if (file.mimeType.startsWith("image/")) images.push(file)
    else documents.push(file)
  }
  return { images, documents }
}
