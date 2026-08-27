import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupVerifyClient } from "@/components/auth/SignupVerifyClient";
import { redirectIfAuthenticated } from "@/lib/auth/require";

export const metadata: Metadata = {
  title: "Fiók aktiválása",
};

export default async function SignupVerifyPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      variant="verify"
      title="Fiók aktiválása"
      subtitle="Egy pillanat, létrehozzuk a próba szervezetet."
    >
      <Suspense
        fallback={<p className="text-[14px] text-faint">Betöltés…</p>}
      >
        <SignupVerifyClient />
      </Suspense>
    </AuthShell>
  );
}
