"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

type NavLinkProps = {
  href: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function NavLink({ href, children, className = "", onClick }: NavLinkProps) {
  const pathname = usePathname()
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-link ${active ? "nav-link--active" : ""} ${className}`}
    >
      {children}
    </Link>
  )
}
