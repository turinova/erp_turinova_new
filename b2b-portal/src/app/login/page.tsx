import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { redirectIfAuthenticated } from "@/lib/auth/require";

export const metadata: Metadata = {
  title: "Bejelentkezés",
};

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <TurinovaWordmark height={28} />
        </div>

        <div className="border border-line-strong bg-surface p-6">
          <h1 className="text-[22px] font-semibold tracking-tight">Belépés</h1>
          <p className="mt-2 text-[13px] text-faint">
            Csak meghívóval. Nincs nyilvános regisztráció.
          </p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-faint">
          <Link href="/" className="underline underline-offset-2 hover:text-text">
            Vissza
          </Link>
        </p>
      </div>
    </main>
  );
}
