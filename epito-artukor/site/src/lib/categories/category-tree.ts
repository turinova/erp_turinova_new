import type { Category, Trade } from "@/types"

export function buildCategoryMap(categories: Category[]): Record<string, Category> {
  return Object.fromEntries(categories.map((c) => [c.id, c]))
}

export function getCategoryPath(categoryId: string, categories: Category[]): string {
  const map = buildCategoryMap(categories)
  const parts: string[] = []
  let current: Category | undefined = map[categoryId]
  const visited = new Set<string>()

  while (current) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    parts.unshift(current.name)
    current = current.parentId ? map[current.parentId] : undefined
  }

  return parts.join(" › ")
}

export function getCategoriesByTrade(trade: Trade, categories: Category[]): Category[] {
  return categories.filter((c) => c.trade === trade).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getCategoriesForTradeSelect(trade: Trade, categories: Category[]): Category[] {
  return categories
    .filter((c) => c.trade === trade)
    .sort((a, b) => {
      if (!a.parentId && b.parentId) return -1
      if (a.parentId && !b.parentId) return 1
      return a.sortOrder - b.sortOrder
    })
}

export function getDefaultCategoryForTrade(trade: Trade, categories: Category[]): string {
  const leaf = categories
    .filter((c) => c.trade === trade && c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  if (leaf) return leaf.id
  return categories.find((c) => c.trade === trade)?.id ?? ""
}

export function collectDescendantIds(categoryId: string, categories: Category[]): string[] {
  const childrenByParent = new Map<string, Category[]>()
  for (const cat of categories) {
    if (!cat.parentId) continue
    const list = childrenByParent.get(cat.parentId) ?? []
    list.push(cat)
    childrenByParent.set(cat.parentId, list)
  }

  const result: string[] = []
  const stack = [categoryId]

  while (stack.length > 0) {
    const id = stack.pop()
    if (!id) continue
    const children = childrenByParent.get(id) ?? []
    for (const child of children) {
      result.push(child.id)
      stack.push(child.id)
    }
  }

  return result
}

export function isDescendantOf(
  categoryId: string,
  potentialAncestorId: string,
  categories: Category[]
): boolean {
  const map = buildCategoryMap(categories)
  let current = map[categoryId]
  const visited = new Set<string>()

  while (current?.parentId) {
    if (visited.has(current.id)) break
    visited.add(current.id)
    if (current.parentId === potentialAncestorId) return true
    current = map[current.parentId]
  }

  return false
}
