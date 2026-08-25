"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NearLimitBanner,
  PartnerUsageBar,
  UpgradeBanner,
} from "@/components/merchant/PartnerUsageBar";

type CatalogPayload = {
  catalogStatus: string;
  productCount: number;
  progressPct: number;
  error: string | null;
  partnerUsed?: number;
  partnerLimit?: number;
  paidPartnerLimit?: number;
  isTrial?: boolean;
  overCap?: boolean;
  warn80?: boolean;
  planLabel?: string;
  job?: { id: string; status: string } | null;
};

function story(
  status: string,
  count: number,
  pct: number,
): {
  title: string;
  body: string;
  tone: "ok" | "bad" | "idle";
} {
  if (status === "ready") {
    return {
      title: "A termékek megvannak",
      body: `${count.toLocaleString("hu-HU")} termék kereshető a gyors rendelésben. A vevő cikkszámra vagy gyári számra talál.`,
      tone: "ok",
    };
  }
  if (status === "syncing" || status === "pending") {
    return {
      title: "Még másoljuk a termékeket",
      body:
        pct > 0
          ? `Kb. ${pct}% kész. Várj pár percet — utána a kereső a boltban működik.`
          : "A boltodból átmásoljuk a termékeket. Ez eltarthat.",
      tone: "idle",
    };
  }
  if (status === "blocked_limit") {
    return {
      title: "Elfogyott a hely a termékeknek",
      body: "Ami már bent van, arra lehet keresni. Új termék nem jön, amíg több termékhely nincs.",
      tone: "bad",
    };
  }
  if (status === "error") {
    return {
      title: "Nem sikerült a másolás",
      body: "Próbáld újra. Ha megint elakad, a bolt-jelszó lehet rossz.",
      tone: "bad",
    };
  }
  return {
    title: "Termékek",
    body: "Még nincs infó.",
    tone: "idle",
  };
}

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

export function CatalogStatusPanel() {
  const [data, setData] = useState<CatalogPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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
        return;
      }
      setData((prev) =>
        prev
          ? { ...prev, catalogStatus: "pending", progressPct: 0, job: null }
          : prev,
      );
      await load();
    } catch {
      setError("Nincs kapcsolat.");
    } finally {
      setPending(false);
    }
  }

  const s = story(
    data?.catalogStatus ?? "pending",
    data?.productCount ?? 0,
    data?.progressPct ?? 0,
  );
  const chip =
    s.tone === "ok"
      ? "border-ok text-ok"
      : s.tone === "bad"
        ? "border-danger text-danger"
        : "border-line-strong text-text";

  const partnerUsed = data?.partnerUsed ?? 0;
  const partnerLimit = data?.partnerLimit ?? 0;
  const overCap = partnerLimit > 0 && partnerUsed > partnerLimit;
  const warn80 = partnerLimit > 0 && partnerUsed / partnerLimit >= 0.8;

  return (
    <>
      <section className="tn-section mb-6">
        <p className="tn-label">Termékek a gyors rendelésben</p>
        <h3 className="tn-section-title mt-1">{s.title}</h3>
        <p className="tn-section-sub">{s.body}</p>
        {data?.catalogStatus === "syncing" ||
        data?.catalogStatus === "pending" ? (
          <div
            className={`mt-3 inline-flex h-10 items-center rounded-none border-2 px-3 ${chip}`}
          >
            <span className="text-[13px] font-bold">{data.progressPct}%</span>
          </div>
        ) : null}
        {data?.error ? (
          <p className="mt-2 text-[13px] text-danger">{data.error}</p>
        ) : null}
        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
        <button
          type="button"
          onClick={() => void resync()}
          disabled={pending}
          className="tn-btn tn-btn-ghost mt-4 !h-9"
        >
          {pending ? "…" : "Másold újra a termékeket"}
        </button>
      </section>

      {data && partnerLimit > 0 ? (
        <div className="mb-6">
          <PartnerUsageBar
            used={partnerUsed}
            limit={partnerLimit}
            paidLimit={data.paidPartnerLimit ?? partnerLimit}
            overCap={data.overCap ?? overCap}
            warn80={data.warn80 ?? warn80}
            isTrial={Boolean(data.isTrial)}
            planLabel={data.planLabel}
          />
          {overCap ? (
            <div className="mt-4">
              <UpgradeBanner used={partnerUsed} limit={partnerLimit} />
            </div>
          ) : warn80 && !data.isTrial ? (
            <div className="mt-4">
              <NearLimitBanner used={partnerUsed} limit={partnerLimit} />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
