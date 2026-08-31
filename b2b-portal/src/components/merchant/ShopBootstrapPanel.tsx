"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BootstrapSnapshot } from "@/lib/commerce/bootstrap";

type Props = {
  /** Kezdeti állapot SSR-ből (opcionális). */
  initial?: BootstrapSnapshot | null;
  compact?: boolean;
};

function StepIcon({ done, running }: { done: boolean; running: boolean }) {
  if (done) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-accent text-white">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 6.5L5 9L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      </span>
    );
  }
  if (running) {
    return (
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center border border-accent text-accent"
        aria-hidden
      >
        <span className="h-2 w-2 animate-pulse bg-accent" />
      </span>
    );
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-surface text-faint"
      aria-hidden
    />
  );
}

export function ShopBootstrapPanel({ initial = null, compact = false }: Props) {
  const [data, setData] = useState<BootstrapSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/merchant/bootstrap", {
        signal: ac.signal,
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        bootstrap?: BootstrapSnapshot | null;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Nem sikerült lekérdezni.");
        return;
      }
      setData(json.bootstrap ?? null);
      setError(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Nincs kapcsolat.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Csak amíg a termék-másolás fut — rendelés háttér, ne polloljon örökké.
    const catalogStep = data?.steps.find((s) => s.id === "catalog");
    if (!data?.running && !catalogStep?.running) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [data?.running, data?.steps, load]);

  if (!data) {
    if (error) {
      return (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      );
    }
    return null;
  }

  if (data.ready) return null;

  const showPanel =
    data.running ||
    data.status === "error" ||
    data.status === "pending" ||
    !data.steps.find((s) => s.id === "connect")?.done;

  if (!showPanel) return null;

  return (
    <section
      className={
        compact
          ? "border border-line-strong bg-surface-2/60 p-4"
          : "tn-section mt-8"
      }
    >
      {!compact ? <p className="tn-label">Bolt betöltése</p> : null}
      <h2
        className={
          compact
            ? "text-[15px] font-semibold tracking-tight"
            : "tn-section-title mt-1"
        }
      >
        {data.status === "error"
          ? "Valami elakadt"
          : "Másoljuk a bolt adatait"}
      </h2>
      <p className={compact ? "mt-1 text-[12px] text-faint" : "tn-section-sub"}>
        {data.status === "error"
          ? (data.error ??
            "Nézd meg a Beállításokat, vagy próbáld újra az összekötést.")
          : "Ez pár percig eltarthat. Utána a kereső és a riportok is készen lesznek — nem kell külön frissíteni."}
      </p>

      <ul className="mt-4 divide-y divide-line border border-line-strong">
        {data.steps.map((step) => (
          <li
            key={step.id}
            className="flex items-center gap-3 px-3 py-2.5 text-[13px]"
          >
            <StepIcon done={step.done} running={step.running} />
            <span className={step.done ? "text-faint" : "font-medium text-text"}>
              {step.label}
            </span>
            {step.detail ? (
              <span className="ml-auto text-[12px] tabular-nums text-faint">
                {step.detail}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {data.status === "error" ? (
        <Link
          href="/settings"
          className="tn-btn tn-btn-primary mt-4 inline-flex cursor-pointer"
        >
          Beállítások
        </Link>
      ) : null}
    </section>
  );
}

/** Haladó: összecsukható újraszinkron — csak bootstrap után. */
export function CatalogResyncAdvancedButton() {
  const [bootstrapReady, setBootstrapReady] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/merchant/bootstrap")
      .then((r) => r.json())
      .then((j: { bootstrap?: BootstrapSnapshot | null }) => {
        setBootstrapReady(j.bootstrap?.ready ?? true);
      })
      .catch(() => setBootstrapReady(true));
  }, []);

  if (bootstrapReady === null || !bootstrapReady) return null;

  async function resync() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/catalog/resync", {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) setError(json.error ?? "Nem indult el.");
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-line-strong bg-surface-2/40 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between text-left text-[13px] font-semibold"
      >
        <span>Haladó</span>
        <span className="text-[12px] font-medium text-faint">
          {open ? "Elrejt" : "Megnyit"}
        </span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <p className="w-full text-[12px] text-faint">
            Ha a kereső elavult vagy hibás, másold újra a termékeket a boltból.
          </p>
          <button
            type="button"
            onClick={() => void resync()}
            disabled={pending}
            className="tn-btn tn-btn-ghost"
            title="Másold újra a termékeket a boltból"
          >
            {pending ? "…" : "Termékek újratöltése"}
          </button>
          {error ? (
            <span className="text-[12px] font-medium text-danger" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
