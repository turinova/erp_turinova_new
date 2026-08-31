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

/** Status only — resync is CatalogResyncAdvancedButton on Beállítások. */
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
      const res = await fetch("/api/merchant/catalog", {
        signal: ac.signal,
        cache: "no-store",
      });
      const json = (await res.json()) as CatalogPayload & { error?: string };
      if (!res.ok) {
        if (seq === fetchSeq.current) {
          setError(json.error ?? "Nem sikerült lekérdezni.");
        }
        return;
      }
      if (seq === fetchSeq.current) {
        setData((prev) => mergeCatalogPayload(prev, json));
        setError(null);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (seq === fetchSeq.current) setError("Nincs kapcsolat.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncing =
      data?.catalogStatus === "syncing" || data?.catalogStatus === "pending";
    if (!syncing) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [data?.catalogStatus, load]);

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

/** @deprecated Use CatalogStatusChip. */
export function CatalogStatusPanel() {
  return <CatalogStatusChip />;
}
