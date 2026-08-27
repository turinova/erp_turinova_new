"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteAcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!acceptedLegal) {
      setError("Az ÁSZF és az adatkezelési tájékoztató elfogadása kötelező.");
      return;
    }
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const displayName = String(fd.get("displayName") ?? "");

    try {
      const res = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, displayName }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sikertelen");
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
    <form className="mt-3 flex flex-col gap-3" onSubmit={onSubmit}>
      <p className="text-[12px] text-muted">
        Fiók: <span className="font-medium text-text">{email}</span>
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-muted">Név</span>
        <input
          name="displayName"
          type="text"
          className="h-9 rounded-none border-[0.5px] border-line-strong bg-surface-2 px-3 text-[13px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-muted">Jelszó</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-9 rounded-none border-[0.5px] border-line-strong bg-surface-2 px-3 text-[13px]"
        />
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-snug text-muted">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={acceptedLegal}
          onChange={(e) => setAcceptedLegal(e.target.checked)}
          required
        />
        <span>
          Elfogadom az{" "}
          <Link
            href="/aszf"
            target="_blank"
            className="font-medium text-text underline underline-offset-2"
          >
            ÁSZF
          </Link>
          -et és az{" "}
          <Link
            href="/adatkezeles"
            target="_blank"
            className="font-medium text-text underline underline-offset-2"
          >
            Adatkezelési tájékoztatót
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p className="text-[12px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !acceptedLegal}
        className="inline-flex h-9 cursor-pointer items-center justify-center rounded-none bg-accent text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Mentés…" : "Fiók aktiválása"}
      </button>
    </form>
  );
}
