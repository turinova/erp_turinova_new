'use client'

import type { LucideIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { PageHeader } from '@/components/patterns/page-header'
import type { NavAccent } from '@/lib/nav-accent'
import { findNavLinkByPath } from '@/lib/navigation'

type PageHeaderWithNavProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
  /** Felülírja a path alapján felismert menüikont / accentet */
  icon?: LucideIcon
  accent?: NavAccent
}

/** PageHeader + az aktuális route menüikonja és accent színe. */
export function PageHeaderWithNav({
  icon,
  accent,
  ...props
}: PageHeaderWithNavProps) {
  const pathname = usePathname()
  const nav = findNavLinkByPath(pathname)
  return (
    <PageHeader
      {...props}
      icon={icon ?? nav?.icon}
      accent={accent ?? nav?.accent ?? 'slate'}
    />
  )
}
