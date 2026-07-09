import type { Category } from "@/types"

/** In-memory cache — a DB (/api/categories) az egyetlen forrás, a primer tölti fel. */
let categoriesCache: Category[] = []
let categoryMapCache: Record<string, Category> = {}

export function setCategoriesCache(categories: Category[]): void {
  categoriesCache = categories
  categoryMapCache = Object.fromEntries(categories.map((c) => [c.id, c]))
}

export function loadCategories(): Category[] {
  return categoriesCache
}

export function saveCategories(categories: Category[]): void {
  setCategoriesCache(categories)
}

/** categoryId → Category lookup (a régi mock categoryMap kiváltása) */
export function getCategoryMap(): Record<string, Category> {
  return categoryMapCache
}

