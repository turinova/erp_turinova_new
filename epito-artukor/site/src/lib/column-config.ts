export type ColumnId =
  | "identifier"
  | "text"
  | "trade"
  | "unit"
  | "material"
  | "labor"
  | "total"
  | "status"
  | "updated"

export type ColumnConfig = {
  id: ColumnId
  label: string
  defaultVisible: boolean
}

export const COLUMNS: ColumnConfig[] = [
  { id: "identifier", label: "Tételszám", defaultVisible: true },
  { id: "text", label: "Tétel szövege", defaultVisible: true },
  { id: "trade", label: "Szakág", defaultVisible: false },
  { id: "unit", label: "ME", defaultVisible: true },
  { id: "material", label: "Anyag egységár", defaultVisible: true },
  { id: "labor", label: "Díj egységre", defaultVisible: true },
  { id: "total", label: "Összesen", defaultVisible: true },
  { id: "status", label: "Státusz", defaultVisible: true },
  { id: "updated", label: "Frissítve", defaultVisible: false },
]

const STORAGE_KEY = "epito-artukor:column-visibility"

export function loadColumnVisibility(): Record<ColumnId, boolean> {
  const defaults = Object.fromEntries(
    COLUMNS.map((c) => [c.id, c.defaultVisible])
  ) as Record<ColumnId, boolean>

  if (typeof window === "undefined") return defaults
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return defaults
    return { ...defaults, ...JSON.parse(stored) }
  } catch {
    return defaults
  }
}

export function saveColumnVisibility(visibility: Record<ColumnId, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
}
