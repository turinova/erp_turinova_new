import {
  isNavLink,
  type NavGroup,
  type NavNode
} from '@/lib/navigation'

export function filterNavByAccess(
  nodes: NavNode[],
  allowedKeys: string[]
): NavNode[] {
  const allowed = new Set(allowedKeys)
  const result: NavNode[] = []

  for (const node of nodes) {
    if (isNavLink(node)) {
      if (allowed.has(node.href)) {
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
