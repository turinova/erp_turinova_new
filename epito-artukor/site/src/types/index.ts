export type CostItemStatus = "draft" | "active" | "archived"

/** Szakág azonosító — a `trades` tábla `code` mezője (pl. epitomester, burkolas) */
export type Trade = string

export interface Organization {
  id: string
  name: string
  slug: string
}

export interface Unit {
  id: string
  code: string
  name: string
}

export interface Category {
  id: string
  orgId: string
  parentId: string | null
  trade: Trade
  code: string
  name: string
  sortOrder: number
}

export interface CostItem {
  id: string
  orgId: string
  trade: Trade
  identifier: string
  isCustomItem: boolean
  text: string
  shortLabel: string | null
  categoryId: string
  unitId: string
  status: CostItemStatus
  tags: string[]
  materialUnitPrice: number
  laborUnitPrice: number
  totalUnitPrice: number
  createdAt: string
  updatedAt: string
}

export interface CostItemFilters {
  q?: string
  trade?: Trade | "all"
  categoryId?: string
  status?: CostItemStatus | "all"
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type CostItemInput = Omit<
  CostItem,
  "id" | "orgId" | "totalUnitPrice" | "createdAt" | "updatedAt"
> & { id?: string }

/** @deprecated Régi localStorage formátum migrálásához */
export interface LegacyCostItem {
  id: string
  orgId: string
  code?: string
  identifier?: string
  name?: string
  text?: string
  description?: string | null
  shortLabel?: string | null
  trade?: Trade
  isCustomItem?: boolean
  categoryId: string
  unitId: string
  itemType?: string
  status: CostItemStatus
  tags: string[]
  materialUnitPrice: number
  laborUnitPrice: number
  equipmentUnitPrice?: number
  overheadPercent?: number
  totalUnitPrice: number
  createdAt: string
  updatedAt: string
}
