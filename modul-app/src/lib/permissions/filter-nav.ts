import {
  isNavLink,
  type NavGroup,
  type NavNode
} from '@/lib/navigation'
import { pathIsAllowed } from '@/lib/permissions/pages'

export function filterNavByAccess(
  nodes: NavNode[],
  allowedKeys: string[]
): NavNode[] {
  const result: NavNode[] = []

  for (const node of nodes) {
    if (isNavLink(node)) {
      // Ugyanaz a szabály, mint a layout pathIsAllowed — child route
      // (pl. /ertekesitesek/arajanlatok) látszik, ha a parent page_key engedélyezett.
      if (pathIsAllowed(node.href, allowedKeys)) {
        result.push(node)
      }
      continue
    }

    const filteredChildren = filterNavByAccess(node.children, allowedKeys)
    if (filteredChildren.length === 0) continue

    const group: NavGroup = {
      ...node,
      children: filteredChildren
    }
    result.push(group)
  }

  return result
}
