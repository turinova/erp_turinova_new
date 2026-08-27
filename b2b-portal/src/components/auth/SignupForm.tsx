"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setVerifyUrl(null);
    if (!acceptedLegal) {
      setError("Az ÁSZF és az adatkezelési tájékoztató elfogadása kötelező.");
      return;
    }
    setPending(true);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
          companyName: String(fd.get("companyName") ?? ""),
          shoprenterShopName: String(fd.get("shoprenterShopName") ?? ""),
          storeUrl: String(fd.get("storeUrl") ?? "") || undefined,
          acceptedLegal: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        verifyUrl?: string;
        email?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Regisztráció sikertelen");
        setPending(false);
        return;
      }
      setMessage(
        data.message ??
          "Nézd meg az emailed, és erősítsd meg a fiókot a linkkel.",
      );
      if (data.verifyUrl) setVerifyUrl(data.verifyUrl);
      setPending(false);
    } catch {
      setError("Hálózati hiba");
      setPending(false);
    }
  }

  if (message) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-text" role="status">
          {message}
        </p>
        {verifyUrl ? (
          <p className="text-[13px] text-faint">
            Helyi teszt link:{" "}
            <button
              type="button"
              className="font-medium text-text underline underline-offset-2"
              onClick={() => {
                router.push(
                  `/signup/verify?token=${encodeURIComponent(
                    new URL(verifyUrl).searchParams.get("token") || "",
                  )}`,
                );
              }}
            >
              Fiók aktiválása
            </button>
          </p>
        ) : (
          <p className="text-[13px] text-faint">
            A link 48 óráig érvényes. Nem kaptál emailt? Nézd a spamet, vagy
            regisztrálj újra.
          </p>
        )}
        <Link href="/login" className="text-[13px] underline underline-offset-2">
          Van már fiókod? Belépés
        </Link>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-4">
        <label className="tn-field">
          <span className="tn-label">Cég / bolt neve</span>
          <input
            name="companyName"
            required
            minLength={2}
            className="tn-input"
            placeholder="Pl. Vasalatmester Kft."
            autoComplete="organization"
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Email</span>
          <input
            name="email"
            type="email"
            required
            className="tn-input"
            placeholder="te@ceged.hu"
            autoComplete="email"
          />
        </label>
        <label className="tn-field">
          <span className="tn-label">Jelszó</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="tn-input"
            placeholder="min. 8 karakter"
            autoComplete="new-password"
          />
        </label>
      </div>

      <div className="border-t border-line pt-5">
        <p className="tn-label mb-3">Shoprenter bolt</p>
        <div className="flex flex-col gap-4">
          <label className="tn-field">
            <span className="tn-label">Shop name</span>
            <input
              name="shoprenterShopName"
              required
              className="tn-input"
              placeholder="vasalatmester"
              autoComplete="off"
            />
            <span className="mt-1 text-[11px] text-faint">
              A *.shoprenter.hu aldomain, kisbetűvel
            </span>
          </label>
          <label className="tn-field">
            <span className="tn-label">Bolt URL (opcionális)</span>
            <input
              name="storeUrl"
              type="url"
              className="tn-input"
              placeholder="https://pelda.hu"
              autoComplete="url"
            />
          </label>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-snug text-faint">
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
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !acceptedLegal}
        className="tn-btn tn-btn-primary w-full cursor-pointer"
      >
        {pending ? "…" : "14 napos próba indítása"}
      </button>
      <p className="text-[12px] text-faint">
        Email megerősítés után jön létre a fiók. A próba lejárta után a nem
        használt fiókokat automatikusan töröljük.
      </p>
    </form>
  );
}
