"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { APP_NAME } from "@/lib/nav-config"
import { persistClientAuthUser } from "@/lib/auth/client-user"
import type { AuthOrganization, AuthUser } from "@/lib/auth/types"
import { TurinovaProductLockup } from "@/components/brand/turinova-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginResponse = {
  success?: boolean
  error?: string
  user?: AuthUser
  organization?: AuthOrganization | null
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/ajanlatok"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as LoginResponse
      if (!res.ok || !data.success || !data.user) {
        toast.error(data.error ?? "Bejelentkezés sikertelen")
        return
      }
      persistClientAuthUser(data.user)
      toast.success(
        data.organization
          ? `Bejelentkezve: ${data.organization.name}`
          : "Sikeres bejelentkezés"
      )
      router.replace(nextPath.startsWith("/") ? nextPath : "/ajanlatok")
      router.refresh()
    } catch {
      toast.error("Hálózati hiba — próbáld újra")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Jelszó</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Bejelentkezés…
          </>
        ) : (
          "Bejelentkezés"
        )}
      </Button>
    </form>
  )
}

export function LoginPageContent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <TurinovaProductLockup
          productName={APP_NAME}
          subtitle="Építőipari ártükör és projektmenedzsment"
          className="mb-8"
        />
        <div className="ea-card p-6">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Bejelentkezés</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Add meg az építésvezetői fiókod adatait.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
        <p className="mt-8 text-center text-[11px] uppercase tracking-wider text-[var(--sidebar-muted)]">
          Turinova üzleti szoftver
        </p>
      </div>
    </div>
  )
}
