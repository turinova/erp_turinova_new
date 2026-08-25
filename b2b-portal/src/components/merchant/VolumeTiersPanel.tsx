"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { effectiveNet, costPlusNet } from "@/lib/merchant/pricing-engine";

type TierDraft = { minQty: string; priceNet: string };

type Props = {
  groupId: string;
  productInnerId: number;
  listPriceNet: number | null;
  groupPercent: number | null;
  ownGroupNet: number | null;
  costNet: number | null;
  onClose: () => void;
  /** Mentés / heal után: lista badge frissítés. */
  onSaved?: (info: {
    tierCount: number;
    tierSummary: string | null;
  }) => void;
};

function formatTierLine(minQty: number, priceNet: number): string {
  return `${minQty}+ → ${Math.round(priceNet).toLocaleString("hu-HU")} Ft`;
}

function compactSummary(
  tiers: { minQty: number }[],
): string | null {
  if (!tiers.length) return null;
  const head = tiers
    .slice(0, 3)
    .map((t) => `${t.minQty}+`)
    .join("/");
  return tiers.length > 3 ? `${head}…` : head;
}

export function VolumeTiersPanel({
  groupId,
  productInnerId,
  listPriceNet,
  groupPercent,
  ownGroupNet,
  costNet,
  onClose,
  onSaved,
}: Props) {
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const [drafts, setDrafts] = useState<TierDraft[]>([
    { minQty: "10", priceNet: "" },
  ]);
  const [savedCount, setSavedCount] = useState(0);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [mirrorWarn, setMirrorWarn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/merchant/prices/tiers?groupId=${encodeURIComponent(groupId)}&productInnerId=${productInnerId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Betöltés sikertelen");
      const tiers = Array.isArray(data.tiers) ? data.tiers : [];
      setMirrorWarn(
        data.mirrorOk === false
          ? `Lista-badge tükör hiba: ${data.mirrorError || "ismeretlen"}`
          : null,
      );
      if (tiers.length) {
        setDrafts(
          tiers.map((t: { minQty: number; priceNet: number }) => ({
            minQty: String(t.minQty),
            priceNet: String(t.priceNet),
          })),
        );
        setSavedCount(tiers.length);
        setSavedSummary(
          tiers
            .map((t: { minQty: number; priceNet: number }) =>
              formatTierLine(t.minQty, t.priceNet),
            )
            .join(" · "),
        );
        onSavedRef.current?.({
          tierCount: tiers.length,
          tierSummary: compactSummary(tiers),
        });
      } else {
        const list = listPriceNet ?? 0;
        const base = effectiveNet({
          listNet: list,
          groupPercent,
          ownGroupNet,
          qty: 1,
        }).net;
        const suggest =
          costNet != null
            ? costPlusNet(costNet, 20)
            : Math.round(base * 0.9);
        setDrafts([
          {
            minQty: "10",
            priceNet: suggest != null ? String(suggest) : "",
          },
        ]);
        setSavedCount(0);
        setSavedSummary(null);
        onSavedRef.current?.({ tierCount: 0, tierSummary: null });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Betöltés sikertelen");
    } finally {
      setLoading(false);
    }
  }, [
    groupId,
    productInnerId,
    listPriceNet,
    groupPercent,
    ownGroupNet,
    costNet,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(clear = false) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const tiers = clear
        ? []
        : drafts
            .map((d) => ({
              minQty: Number(d.minQty.replace(",", ".")),
              priceNet: Number(d.priceNet.replace(/\s/g, "").replace(",", ".")),
            }))
            .filter(
              (t) =>
                Number.isFinite(t.minQty) &&
                t.minQty >= 1 &&
                Number.isFinite(t.priceNet) &&
                t.priceNet >= 0,
            );

      if (!clear && tiers.length === 0) {
        throw new Error("Adj meg legalább egy sávot (db + Ft).");
      }

      const res = await fetch("/api/merchant/prices/tiers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, productInnerId, tiers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mentés sikertelen");
      const saved = Array.isArray(data.tiers) ? data.tiers : [];
      setMirrorWarn(
        data.mirrorOk === false
          ? `Lista-badge tükör hiba: ${data.mirrorError || "ismeretlen"}`
          : null,
      );
      setMessage(
        data.message ||
          (clear ? "Sávok törölve." : `${saved.length} sáv mentve.`),
      );
      if (clear) {
        setSavedCount(0);
        setSavedSummary(null);
        onSavedRef.current?.({ tierCount: 0, tierSummary: null });
        onClose();
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  }

  const previewQty = [1, 10, 50];
  const specials = drafts
    .map((d) => ({
      price: Number(d.priceNet.replace(/\s/g, "").replace(",", ".")),
      minQty: Number(d.minQty.replace(",", ".")),
      maxQty: null as number | null,
    }))
    .filter(
      (s) =>
        Number.isFinite(s.price) &&
        Number.isFinite(s.minQty) &&
        s.minQty > 0,
    );

  return (
    <div className="border-t border-line-strong bg-surface-2 px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-text">
            Mennyiségi sávok
            {!loading ? (
              <span className="ml-1.5 font-medium text-faint">
                ·{" "}
                {savedCount > 0
                  ? `${savedCount} sáv aktív`
                  : "nincs mentett sáv"}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">
            Pl. 10+ db olcsóbb. A Shoprenterbe mentjük. Fix partnerár továbbra is
            mindent felülír.
          </p>
          {!loading && savedSummary ? (
            <p className="mt-1.5 text-[11px] font-medium tabular-nums text-text">
              Mentve: {savedSummary}
            </p>
          ) : null}
          {!loading && mirrorWarn ? (
            <p className="mt-1 text-[11px] font-medium text-amber-700">
              {mirrorWarn}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer text-[11px] font-semibold text-faint hover:text-text"
        >
          Bezár
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-[12px] text-faint">Betöltés…</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-faint">
                  Min. db
                  <input
                    className="h-7 w-16 rounded-none border border-line-strong bg-surface px-1.5 text-[12px] tabular-nums outline-none focus:border-accent"
                    inputMode="numeric"
                    value={d.minQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) =>
                        prev.map((row, j) =>
                          j === i ? { ...row, minQty: v } : row,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-faint">
                  Nettó Ft
                  <input
                    className="h-7 w-28 rounded-none border border-line-strong bg-surface px-1.5 text-[12px] tabular-nums outline-none focus:border-accent"
                    inputMode="decimal"
                    value={d.priceNet}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDrafts((prev) =>
                        prev.map((row, j) =>
                          j === i ? { ...row, priceNet: v } : row,
                        ),
                      );
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={drafts.length <= 1}
                  onClick={() =>
                    setDrafts((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="cursor-pointer text-[11px] font-semibold text-faint disabled:opacity-30"
                >
                  Töröl
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={drafts.length >= 5}
              onClick={() =>
                setDrafts((prev) => [
                  ...prev,
                  {
                    minQty: String(
                      (Number(prev[prev.length - 1]?.minQty) || 10) + 10,
                    ),
                    priceNet: "",
                  },
                ])
              }
              className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold disabled:opacity-35"
            >
              + Sáv
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className="tn-btn tn-btn-primary h-7 cursor-pointer px-3 text-[11px]"
            >
              {saving ? "Mentés…" : "Mentés"}
            </button>
            {savedCount > 0 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (
                    window.confirm(
                      "Törlöd az összes mennyiségi sávot ennél a terméknél?",
                    )
                  ) {
                    void save(true);
                  }
                }}
                className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
              >
                Összes sáv törlése
              </button>
            ) : null}
          </div>

          {specials.length > 0 && listPriceNet != null ? (
            <p className="mt-3 text-[11px] text-faint">
              Előnézet (fix nélkül):{" "}
              {previewQty.map((qty) => {
                const eff = effectiveNet({
                  listNet: listPriceNet,
                  groupPercent,
                  ownGroupNet: null,
                  specials,
                  qty,
                });
                return (
                  <span key={qty} className="mr-3 tabular-nums">
                    {qty} db → {Math.round(eff.net).toLocaleString("hu-HU")} Ft
                    {eff.source === "tier" ? " (sáv)" : ""}
                  </span>
                );
              })}
            </p>
          ) : null}

          {error ? (
            <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-2 text-[12px] font-medium text-ok">{message}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
