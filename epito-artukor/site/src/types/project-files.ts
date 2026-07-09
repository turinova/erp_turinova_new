export type ProjectFileCategory =
  | "site_photo"
  | "floor_plan"
  | "technical"
  | "permit"
  | "contract"
  | "quote_export"
  | "sub_rfq"
  | "other"

/** Felhasználó által kezelt projekt mappa */
export interface ProjectFileFolderRecord {
  id: string
  projectId: string
  orgId: string
  name: string
  sortOrder: number
  /** Rendszer mappa — nem törölhető (auto PDF stb.) */
  isSystem?: boolean
  createdAt: string
}

export interface ProjectFile {
  id: string
  projectId: string
  orgId: string
  /** Felhasználói mappa — elsődleges rendezés */
  folderId: string
  /** Háttér-metaadat (borítókép, auto export) — nem UI választás */
  category: ProjectFileCategory
  title: string
  description?: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** `storage:<Supabase Storage útvonal>` vagy `url:https://...` */
  storageKey: string
  quoteId?: string
  rfqPackageId?: string
  takenAt?: string
  isCover?: boolean
  uploadedAt: string
  sortOrder: number
}

export type ProjectFileFilters = {
  q?: string
  folderId?: string | "all"
  category?: ProjectFileCategory | "all"
}

export type ProjectFileFolderInput = Pick<
  ProjectFileFolderRecord,
  "projectId" | "name"
> & {
  orgId?: string
  isSystem?: boolean
  sortOrder?: number
}
