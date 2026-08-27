"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SignupVerifyClient() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Hiányzó aktiváló token");
      setPending(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/signup/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          redirectTo?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Aktiválás sikertelen");
          setPending(false);
          return;
        }
        router.replace(data.redirectTo ?? "/settings");
        router.refresh();
      } catch {
        if (!cancelled) {
          setError("Hálózati hiba");
          setPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (pending) {
    return (
      <p className="text-[14px] text-faint" role="status">
        Fiók létrehozása…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] font-medium text-danger" role="alert">
        {error}
      </p>
      <Link href="/signup" className="text-[13px] underline underline-offset-2">
        Új próba indítása
      </Link>
      <Link href="/login" className="text-[13px] underline underline-offset-2">
        Belépés
      </Link>
    </div>
  );
}
