"use client"

import { useCallback, useEffect, useState } from "react"
import { LogOut, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { clearClientAuthUser } from "@/lib/auth/client-user"
import type { AuthOrganization, AuthUser } from "@/lib/auth/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CurrentUserSwitcherProps = {
  collapsed?: boolean
}

type MeResponse = {
  user: AuthUser
  organization?: AuthOrganization | null
}

export function CurrentUserSwitcher({ collapsed }: CurrentUserSwitcherProps) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [organization, setOrganization] = useState<AuthOrganization | null>(null)

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (!res.ok) {
        setUser(null)
        setOrganization(null)
        return
      }
      const data = (await res.json()) as MeResponse
      setUser(data.user)
      setOrganization(data.organization ?? null)
    } catch {
      setUser(null)
      setOrganization(null)
    }
  }, [])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    clearClientAuthUser()
    router.replace("/login")
    router.refresh()
  }

  if (!user) return null

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-[var(--muted)] text-[var(--foreground)]"
          title={organization ? `${user.email} · ${organization.name}` : user.email}
        >
          <User className="h-4 w-4" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--sidebar-muted)]"
          onClick={() => void handleLogout()}
          title="Kijelentkezés"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-2">
      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-2">
        <p className="truncate text-xs font-medium text-[var(--foreground)]">{user.displayName}</p>
        <p className="truncate text-[11px] text-[var(--muted-foreground)]">{user.email}</p>
        {organization ? (
          <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-[var(--brand)]">
            {organization.name}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start gap-2 text-[var(--sidebar-foreground)] hover:text-[var(--foreground)]"
        )}
        onClick={() => void handleLogout()}
      >
        <LogOut className="h-3.5 w-3.5" />
        Kijelentkezés
      </Button>
    </div>
  )
}
