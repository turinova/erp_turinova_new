"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CatalogPayload = {
  catalogStatus: string;
  productCount: number;
  progressPct: number;
  error: string | null;
  job?: { id: string; status: string } | null;
};

function mergeCatalogPayload(
  prev: CatalogPayload | null,
  next: CatalogPayload,
): CatalogPayload {
  const syncing =
    next.catalogStatus === "syncing" || next.catalogStatus === "pending";
  if (!prev || !syncing) return next;
  const sameJob =
    !prev.job?.id || !next.job?.id || prev.job.id === next.job.id;
  if (!sameJob) return next;
  return {
    ...next,
    progressPct: Math.max(prev.progressPct ?? 0, next.progressPct ?? 0),
  };
}

function catalogChip(data: CatalogPayload | null): {
  value: string;
  tone: "ok" | "bad" | "idle";
  title: string;
} {
  if (!data) {
    return { value: "…", tone: "idle", title: "Termékek betöltése" };
  }
  const n = data.productCount.toLocaleString("hu-HU");
  if (data.catalogStatus === "ready") {
    return {
      value: `${n} termék`,
      tone: "ok",
      title: `${n} termék kereshető a gyors rendelésben`,
    };
  }
  if (
    data.catalogStatus === "syncing" ||
    data.catalogStatus === "pending"
  ) {
    return {
      value: data.progressPct > 0 ? `${data.progressPct}%` : "másolás…",
      tone: "idle",
      title: "Termékek másolása folyamatban",
    };
  }
  if (data.catalogStatus === "blocked_limit") {
    return {
      value: n ? `${n} termék` : "Tele",
      tone: "bad",
      title: "Elfogyott a hely a termékeknek",
    };
  }
  if (data.catalogStatus === "error") {
    return {
      value: "Hiba",
      tone: "bad",
      title: data.error || "Nem sikerült a másolás",
    };
  }
  return { value: "—", tone: "idle", title: "Kereső" };
}

/** Status only — no action buttons. */
export function CatalogStatusChip() {
  const [data, setData] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++fetchSeq.current;
    try {
      const res = await fetch("/api/merchant/catalog", { signal: ac.signal });
      const json = (await res.json()) as CatalogPayload & { error?: string };
      if (seq !== fetchSeq.current) return;
      if (!res.ok) {
        setError(json.error ?? "Nem sikerült betölteni.");
        return;
      }
      setError(null);
      setData((prev) => mergeCatalogPayload(prev, json));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (seq !== fetchSeq.current) return;
      setError("Nincs kapcsolat.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [load]);

  const chip = catalogChip(data);
  const styles =
    chip.tone === "ok"
      ? "border-ok text-ok"
      : chip.tone === "bad"
        ? "border-danger text-danger"
        : "border-line-strong text-text";

  return (
    <>
      <div
        className={`inline-flex h-10 items-center gap-2 rounded-none border-2 px-3 ${styles}`}
        role="status"
        title={chip.title}
      >
        <span className="text-[12px] font-medium text-faint">Kereső</span>
        <span className="text-[13px] font-bold tracking-tight">{chip.value}</span>
      </div>
      {error ? (
        <span className="text-[12px] font-medium text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Action button — sits with Mentés / Működik?, not among status chips. */
export function CatalogResyncButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resync() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/catalog/resync", {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Nem indult el.");
      }
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void resync()}
        disabled={pending}
        className="tn-btn tn-btn-ghost"
        title="Másold újra a termékeket a boltból"
      >
        {pending ? "…" : "Frissítés"}
      </button>
      {error ? (
        <span className="text-[12px] font-medium text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** @deprecated Use CatalogStatusChip in the settings status row. */
export function CatalogStatusPanel() {
  return <CatalogStatusChip />;
}
