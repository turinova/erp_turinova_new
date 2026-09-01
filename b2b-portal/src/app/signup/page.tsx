import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { LegalFooterLinks } from "@/components/legal/LegalFooterLinks";
import { redirectIfAuthenticated } from "@/lib/auth/require";
import { marketingHomeHref } from "@/lib/hosts";

export const metadata: Metadata = {
  title: "Próba regisztráció",
};

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      variant="signup"
      title="Indítsd a 14 napos próbát"
      subtitle="Email megerősítés után azonnal használhatod. Nincs bankkártya."
      footer={
        <>
          Van már fiókod?{" "}
          <Link
            href="/login"
            className="font-medium text-text underline underline-offset-2 hover:text-accent-ink"
          >
            Belépés
          </Link>
          <span className="mx-2 text-line">·</span>
          <Link
            href={marketingHomeHref()}
            className="underline underline-offset-2 hover:text-text"
          >
            Vissza
          </Link>
          <LegalFooterLinks />
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
