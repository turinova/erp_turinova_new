import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { redirectIfAuthenticated } from "@/lib/auth/require";

export const metadata: Metadata = {
  title: "Bejelentkezés",
};

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      variant="login"
      title="Belépés a portálba"
      footer={
        <>
          Nincs fiókod?{" "}
          <Link
            href="/signup"
            className="font-medium text-text underline underline-offset-2 hover:text-accent-ink"
          >
            14 napos próba
          </Link>
          <span className="mx-2 text-line">·</span>
          <Link
            href="/"
            className="underline underline-offset-2 hover:text-text"
          >
            Vissza
          </Link>
          <LegalFooterLinks />
        </>
      }
    >
      <Suspense fallback={<p className="text-[13px] text-faint">…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
