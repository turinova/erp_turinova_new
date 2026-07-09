import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginPageContent } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Bejelentkezés",
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-[var(--muted-foreground)]">Betöltés…</p>}>
      <LoginPageContent />
    </Suspense>
  )
}
