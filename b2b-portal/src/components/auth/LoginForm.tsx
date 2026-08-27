"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const reason = search.get("reason");
  const [error, setError] = useState<string | null>(
    reason === "suspended"
      ? "A fiók fel van függesztve. Írj a hello@turinova.hu címre, ha szerinted ez hiba."
      : null,
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Bejelentkezés sikertelen");
        setPending(false);
        return;
      }
      router.replace(data.redirectTo ?? "/home");
      router.refresh();
    } catch {
      setError("Hálózati hiba");
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="tn-field">
        <span className="tn-label">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          placeholder="te@ceged.hu"
          className="tn-input"
        />
      </label>
      <label className="tn-field">
        <span className="tn-label">Jelszó</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="tn-input"
        />
      </label>
      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="tn-btn tn-btn-primary w-full cursor-pointer"
      >
        {pending ? "…" : "Belépés"}
      </button>
    </form>
  );
}
