import type { ProjectFile, ProjectFileCategory } from "@/types/project-files"

export const DEFAULT_FOLDER_NAMES = {
  survey: "Felmérés",
  plans: "Tervek",
  official: "Szerződések és engedélyek",
  other: "Egyéb",
  system: "Rendszer",
} as const

export function formatPhotoDateLabel(isoDate: string): string {
  return new Date(isoDate + (isoDate.length === 10 ? "T12:00:00" : "")).toLocaleDateString(
    "hu-HU",
    { year: "numeric", month: "long", day: "numeric" }
  )
}

export function inferCategoryFromFile(file: File): ProjectFileCategory {
  if (file.type.startsWith("image/")) return "site_photo"
  if (file.type === "application/pdf") return "floor_plan"
  return "other"
}

export function defaultFolderSpecs(): { name: string; isSystem: boolean; categoryKeys: ProjectFileCategory[] }[] {
  return [
    {
      name: DEFAULT_FOLDER_NAMES.survey,
      isSystem: false,
      categoryKeys: ["site_photo"],
    },
    {
      name: DEFAULT_FOLDER_NAMES.plans,
      isSystem: false,
      categoryKeys: ["floor_plan", "technical"],
    },
    {
      name: DEFAULT_FOLDER_NAMES.official,
      isSystem: false,
      categoryKeys: ["permit", "contract"],
    },
    {
      name: DEFAULT_FOLDER_NAMES.other,
      isSystem: false,
      categoryKeys: ["other"],
    },
    {
      name: DEFAULT_FOLDER_NAMES.system,
      isSystem: true,
      categoryKeys: ["quote_export", "sub_rfq"],
    },
  ]
}

export function categoryToDefaultFolderName(category: ProjectFileCategory): string {
  for (const spec of defaultFolderSpecs()) {
    if (spec.categoryKeys.includes(category)) return spec.name
  }
  return DEFAULT_FOLDER_NAMES.other
}
