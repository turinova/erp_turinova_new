"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  costPlusNet,
  effectiveNet,
  marginPercent,
  netToGross,
} from "@/lib/merchant/pricing-engine";
import { VolumeTiersPanel } from "@/components/merchant/VolumeTiersPanel";
import { PaperSelect } from "@/components/ui/PaperSelect";

type GroupDto = {
  innerId: number;
  groupId: string | null;
  name: string;
  role: string;
  isDefault: boolean;
  percentDiscount: number | null;
  /** Mirrored volume-tier products for this group. */
  tierProductCount?: number;
  missingFromShop?: boolean;
};

type PriceRow = {
  sku: string;
  name: string | null;
  modelNumber: string | null;
  imageUrl: string | null;
  manufacturerInnerId: number | null;
  manufacturerName: string | null;
  productInnerId: number | null;
  costNet: number | null;
  listPriceNet: number | null;
  listPriceGross: number | null;
  groupPriceNet: number | null;
  groupPriceId: string | null;
  /** Postgres tükör — 0 ha nincs / nincs migráció. */
  tierCount?: number;
  tierSummary?: string | null;
  effectiveNet: number;
  effectiveGross: number;
  discountNet: number | null;
  discountPct: number | null;
  marginPct: number | null;
  vatRate: number;
  priceSource: string;
  active: boolean;
};

type ManufacturerDto = {
  innerId: number;
  name: string;
  productCount: number;
};

type CategoryDto = {
  innerId: number;
  name: string;
  parentInnerId: number | null;
  label: string;
  productCount: number;
};

type WorkTab = "rule" | "exceptions" | "tiers";
type ListFilter = "all" | "own" | "tiers";
type BulkScope = "selected" | "manufacturer" | "category";

const DEFAULT_VAT = 27;
const MARGIN_FLOOR_KEY = "tn-arak-margin-floor";
const DEFAULT_MARGIN_FLOOR = 15;

function formatHuf(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

function derivePriceFields(
  row: PriceRow,
  effective: number,
  source: string,
): PriceRow {
  const vat = row.vatRate || DEFAULT_VAT;
  const list = row.listPriceNet;
  const discountNet =
    list != null && effective < list ? list - effective : null;
  const discountPct =
    list != null && list > 0 && discountNet != null
      ? Math.round((discountNet / list) * 1000) / 10
      : null;
  return {
    ...row,
    effectiveNet: effective,
    effectiveGross: netToGross(effective, vat),
    discountNet,
    discountPct,
    marginPct: marginPercent(effective, row.costNet),
    priceSource: source,
  };
}

function recomputeRowPrices(
  rows: PriceRow[],
  groupPercent: number | null,
): PriceRow[] {
  const pct = groupPercent != null && groupPercent > 0 ? groupPercent : null;
  return rows.map((row) => {
    if (row.groupPriceNet != null) return row;
    const list = row.listPriceNet ?? 0;
    const eff = effectiveNet({
      listNet: list,
      groupPercent: pct,
      ownGroupNet: null,
      qty: 1,
    });
    return derivePriceFields(row, eff.net, eff.source);
  });
}

function PricePill({ source, pct }: { source: string; pct: number | null }) {
  if (source === "own") {
    return (
      <span className="ml-1.5 inline-flex shrink-0 bg-accent-soft px-1 py-px text-[9px] font-bold uppercase text-accent">
        fix
      </span>
    );
  }
  if (source === "percent" && pct != null && pct > 0) {
    return (
      <span className="ml-1.5 inline-flex shrink-0 bg-surface-2 px-1 py-px text-[9px] font-semibold text-text">
        −{pct}%
      </span>
    );
  }
  return null;
}

function MarginBadge({ pct, floor }: { pct: number | null; floor: number }) {
  if (pct == null) {
    return <span className="text-[10px] tabular-nums text-faint">—</span>;
  }
  const low = pct < floor;
  const cls =
    pct < 0
      ? "font-bold text-danger"
      : low
        ? "font-semibold text-amber-700"
        : "font-semibold text-ok";
  return (
    <span
      className={`text-[11px] tabular-nums ${cls}`}
      title={low ? `Árrés a min. ${floor}% alatt` : undefined}
    >
      {pct.toLocaleString("hu-HU", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })}
      %{low && pct >= 0 ? " !" : ""}
    </span>
  );
}

function HoverProductLabel({
  title,
  imageUrl,
  tip,
}: {
  title: string;
  imageUrl: string | null;
  tip?: string;
}) {
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  return (
    <>
      <span
        className={
          imageUrl
            ? "block min-w-0 truncate whitespace-nowrap text-[12px] font-medium text-text hover:underline"
            : "block min-w-0 truncate whitespace-nowrap text-[12px] font-medium text-text"
        }
        title={tip || title}
        onMouseEnter={(e) => {
          if (!imageUrl) return;
          const r = e.currentTarget.getBoundingClientRect();
          setPreview({ x: r.left, y: r.bottom + 4 });
        }}
        onMouseLeave={() => setPreview(null)}
      >
        {title}
      </span>
      {preview && imageUrl ? (
        <span
          className="pointer-events-none fixed z-50 w-40 overflow-hidden border border-line-strong bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,.18)]"
          style={{ left: preview.x, top: preview.y }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-36 w-full object-contain"
          />
        </span>
      ) : null}
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 16 }).map((_, i) => (
        <div
          key={i}
          className="flex h-8 animate-pulse items-center gap-2 px-3 md:px-4"
        >
          <div className="h-3 w-3 bg-surface-2" />
          <div className="h-2.5 min-w-0 flex-1 bg-surface-2" />
          <div className="hidden h-2.5 w-20 bg-surface-2 sm:block" />
          <div className="hidden h-2.5 w-24 bg-surface-2 md:block" />
          <div className="h-2.5 w-16 bg-surface-2" />
          <div className="h-2.5 w-20 bg-surface-2" />
          <div className="h-2.5 w-12 bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

function GroupPick({
  group,
  active,
  onSelect,
  onOpenTiers,
  onRemove,
  removing,
}: {
  group: GroupDto;
  active: boolean;
  onSelect: () => void;
  onOpenTiers?: () => void;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const pct = group.percentDiscount;
  const tierN = group.tierProductCount ?? 0;
  const missing = Boolean(group.missingFromShop);
  const canRemove =
    Boolean(onRemove) && !group.isDefault && (missing || Boolean(group.groupId));
  const hasPct = !missing && pct != null && pct > 0;
  const hasTiers = !missing && tierN > 0;
  const canSelect = Boolean(group.groupId) || missing;

  return (
    <div
      className={
        active
          ? "relative min-w-[160px] shrink-0 border-2 border-text bg-surface-2 md:min-w-0 md:w-full"
          : "min-w-[160px] shrink-0 border border-line-strong bg-surface md:min-w-0 md:w-full"
      }
    >
      {active ? (
        <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />
      ) : null}
      <button
        type="button"
        disabled={!canSelect}
        onClick={onSelect}
        className={
          active
            ? "w-full cursor-pointer px-2.5 pb-1 pt-2.5 pr-8 text-left"
            : "w-full cursor-pointer px-2.5 pb-1 pt-2.5 pr-8 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        }
      >
        <span
          className={
            active
              ? "block text-[12px] font-semibold leading-tight text-text"
              : "block text-[12px] font-medium leading-tight text-faint"
          }
        >
          {group.name}
        </span>
      </button>
      {!missing ? (
        <div className="flex flex-wrap items-center gap-1 px-2.5 pb-2 pr-8">
          {hasPct ? (
            <span className="shrink-0 bg-accent px-1 py-px text-[9px] font-bold text-white">
              −{pct}%
            </span>
          ) : (
            <span className="shrink-0 text-[9px] font-semibold text-faint">
              0%
            </span>
          )}
          {hasTiers ? (
            onOpenTiers ? (
              <button
                type="button"
                onClick={onOpenTiers}
                title="Mennyiségi sávok"
                className="shrink-0 cursor-pointer bg-ok/15 px-1 py-px text-[9px] font-bold text-ok hover:underline"
              >
                {tierN} sávos
              </button>
            ) : (
              <span className="shrink-0 bg-ok/15 px-1 py-px text-[9px] font-bold text-ok">
                {tierN} sávos
              </span>
            )
          ) : null}
        </div>
      ) : (
        <div className="px-2.5 pb-2 pr-8">
          <span className="inline-block bg-[rgba(163,45,45,.1)] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-danger">
            Hiányzik a boltból
          </span>
        </div>
      )}
      {!missing && group.isDefault ? (
        <span className="block px-2.5 pb-2 text-[9px] font-semibold uppercase tracking-wide text-faint">
          Alap
        </span>
      ) : null}
      {canRemove ? (
        <button
          type="button"
          title={
            missing
              ? "Eltávolítás a portálból"
              : "Törlés a boltból és a portálból"
          }
          disabled={removing}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="absolute right-1 top-1 flex h-6 w-6 cursor-pointer items-center justify-center text-[14px] leading-none text-faint hover:bg-surface-2 hover:text-danger disabled:opacity-40"
          aria-label={missing ? "Eltávolítás a portálból" : "Csoport törlése"}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (c: string) => `"${c.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCsvMatrix(rows: PriceRow[]): string[][] {
  const out: string[][] = [
    [
      "sku",
      "name",
      "list_net",
      "partner_net",
      "cost_net",
      "margin_pct",
      "source",
    ],
  ];
  for (const r of rows) {
    out.push([
      r.sku,
      r.name ?? "",
      r.listPriceNet != null ? String(r.listPriceNet) : "",
      r.groupPriceNet != null
        ? String(r.groupPriceNet)
        : String(Math.round(r.effectiveNet)),
      r.costNet != null ? String(r.costNet) : "",
      r.marginPct != null ? String(r.marginPct) : "",
      r.priceSource,
    ]);
  }
  return out;
}

export function PricesView() {
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [groupId, setGroupId] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [q, setQ] = useState("");
  const [manufacturerInnerId, setManufacturerInnerId] = useState<number | null>(
    null,
  );
  const [categoryInnerId, setCategoryInnerId] = useState<number | null>(null);
  const [manufacturers, setManufacturers] = useState<ManufacturerDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [ownPriceCount, setOwnPriceCount] = useState(0);
  const [tierProductCount, setTierProductCount] = useState(0);
  const [catalogCount, setCatalogCount] = useState(0);
  const [catalogEmpty, setCatalogEmpty] = useState(false);
  const [percentDiscount, setPercentDiscount] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [workTab, setWorkTab] = useState<WorkTab>("rule");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [savingSku, setSavingSku] = useState<string | null>(null);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPct, setNewPct] = useState("");
  const [creating, setCreating] = useState(false);
  const [editPct, setEditPct] = useState(0);
  const [savingPct, setSavingPct] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [tiersSku, setTiersSku] = useState<string | null>(null);
  const [marginFloor, setMarginFloor] = useState(DEFAULT_MARGIN_FLOOR);
  const [exporting, setExporting] = useState(false);
  const [bulkTierMode, setBulkTierMode] = useState<"abs" | "pct">("pct");
  const [bulkTierDrafts, setBulkTierDrafts] = useState<
    { minQty: string; priceNet: string; pct: string }[]
  >([{ minQty: "10", priceNet: "", pct: "10" }]);
  const [bulkTiersBusy, setBulkTiersBusy] = useState(false);
  const [removingGroupKey, setRemovingGroupKey] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pctSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  /** Session cache: panel open/save után a lista ne veszítse el a badge-et. */
  const tierBadgeBySku = useRef(
    new Map<string, { tierCount: number; tierSummary: string | null }>(),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MARGIN_FLOOR_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0 && n <= 90) setMarginFloor(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/merchant/customer-groups");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Csoportok betöltése sikertelen");
    const gs = (data.groups || []) as GroupDto[];
    setGroups(gs);
    setGroupId((prev) => {
      if (prev && gs.some((g) => g.groupId === prev)) return prev;
      const withId = gs.find((g) => g.groupId);
      return withId?.groupId ?? "";
    });
  }, []);

  const loadPrices = useCallback(
    async (opts: {
      groupId: string;
      q: string;
      page: number;
      manufacturerInnerId: number | null;
      categoryInnerId: number | null;
      ownOnly: boolean;
      tiersOnly: boolean;
    }) => {
      if (!opts.groupId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          groupId: opts.groupId,
          page: String(opts.page),
          limit: "100",
        });
        if (opts.q.trim()) params.set("q", opts.q.trim());
        if (opts.manufacturerInnerId != null) {
          params.set("manufacturerInnerId", String(opts.manufacturerInnerId));
        }
        if (opts.categoryInnerId != null) {
          params.set("categoryInnerId", String(opts.categoryInnerId));
        }
        if (opts.ownOnly) params.set("ownOnly", "1");
        if (opts.tiersOnly) params.set("tiersOnly", "1");
        const res = await fetch(`/api/merchant/prices?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Árak betöltése sikertelen");
        const loaded = ((data.rows || []) as PriceRow[]).map((r) => {
          const apiCount = r.tierCount ?? 0;
          if (apiCount > 0) {
            tierBadgeBySku.current.set(r.sku, {
              tierCount: apiCount,
              tierSummary: r.tierSummary ?? null,
            });
            return r;
          }
          const cached = tierBadgeBySku.current.get(r.sku);
          if (cached && cached.tierCount > 0) {
            return {
              ...r,
              tierCount: cached.tierCount,
              tierSummary: cached.tierSummary,
            };
          }
          return { ...r, tierCount: 0, tierSummary: null };
        });
        const pct = data.group?.percentDiscount ?? null;
        setRows(loaded);
        setPageCount(data.pageCount || 1);
        setOwnPriceCount(data.ownPriceCount ?? 0);
        setTierProductCount(data.tierProductCount ?? 0);
        setGroups((gs) =>
          gs.map((g) =>
            g.groupId === opts.groupId
              ? { ...g, tierProductCount: data.tierProductCount ?? 0 }
              : g,
          ),
        );
        setCatalogCount(data.catalogCount ?? 0);
        setCatalogEmpty(Boolean(data.catalogEmpty));
        setFilteredTotal(Number(data.total) || 0);
        setManufacturers((data.manufacturers || []) as ManufacturerDto[]);
        setCategories((data.categories || []) as CategoryDto[]);
        setPercentDiscount(pct);
        setGroupName(data.group?.name ?? "");
        setEditPct(pct != null && pct > 0 ? pct : 0);
        const nextDrafts: Record<string, string> = {};
        for (const r of loaded) {
          nextDrafts[r.sku] =
            r.groupPriceNet != null ? String(r.groupPriceNet) : "";
        }
        setDrafts(nextDrafts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Árak betöltése sikertelen");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadGroups();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hiba");
        setLoading(false);
      }
    })();
  }, [loadGroups]);

  const needsProductList = workTab === "exceptions" || workTab === "tiers";
  const selectedGroup = groups.find((g) => g.groupId === groupId) ?? null;
  const groupMissing = Boolean(selectedGroup?.missingFromShop);
  const ownOnly =
    workTab === "exceptions" ? listFilter === "own" : false;
  const tiersOnly = workTab === "tiers" ? listFilter === "tiers" : false;

  useEffect(() => {
    if (!groupId || !needsProductList || groupMissing) {
      if (!groupId || groupMissing) setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = q.trim().length > 0 ? 350 : 0;
    debounceRef.current = setTimeout(() => {
      void loadPrices({
        groupId,
        q,
        page,
        manufacturerInnerId,
        categoryInnerId,
        ownOnly,
        tiersOnly,
      });
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    groupId,
    page,
    q,
    manufacturerInnerId,
    categoryInnerId,
    ownOnly,
    tiersOnly,
    needsProductList,
    groupMissing,
    loadPrices,
  ]);

  // Rule tab still needs group meta (name, %, counts) — light fetch once
  useEffect(() => {
    if (!groupId || workTab !== "rule" || groupMissing) return;
    void loadPrices({
      groupId,
      q: "",
      page: 0,
      manufacturerInnerId: null,
      categoryInnerId: null,
      ownOnly: false,
      tiersOnly: false,
    });
  }, [groupId, workTab, groupMissing, loadPrices]);

  useEffect(() => {
    if (editingSku) editInputRef.current?.focus();
  }, [editingSku]);

  async function saveRow(row: PriceRow, raw: string) {
    if (row.productInnerId == null || !groupId) return;
    const trimmed = raw.trim();
    setSavingSku(row.sku);
    setError(null);
    setMessage(null);
    try {
      let priceNet: number | null;
      if (!trimmed) {
        priceNet = null;
      } else {
        const n = Number(trimmed.replace(/\s/g, "").replace(",", "."));
        if (!Number.isFinite(n) || n < 0) throw new Error("Érvénytelen ár.");
        if (n === 0) {
          const ok = window.confirm("0 Ft fix árat mentesz?");
          if (!ok) {
            setSavingSku(null);
            return;
          }
        }
        priceNet = Math.round(n);
      }
      const res = await fetch("/api/merchant/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          productInnerId: row.productInnerId,
          priceNet,
          groupPriceId: row.groupPriceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mentés sikertelen");
      setMessage("Mentve.");
      setEditingSku(null);
      await loadPrices({
        groupId,
        q,
        page,
        manufacturerInnerId,
        categoryInnerId,
        ownOnly,
        tiersOnly,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setSavingSku(null);
    }
  }

  async function savePercent(pct: number) {
    if (!groupId) return;
    setSavingPct(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/customer-groups/sr", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupId, percentDiscount: pct }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mentés sikertelen");
      setPercentDiscount(pct > 0 ? pct : null);
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mentés sikertelen");
    } finally {
      setSavingPct(false);
    }
  }

  function handlePctChange(next: number) {
    setEditPct(next);
    setRows((prev) => recomputeRowPrices(prev, next > 0 ? next : null));
    if (pctSaveRef.current) clearTimeout(pctSaveRef.current);
    pctSaveRef.current = setTimeout(() => {
      void savePercent(next);
    }, 700);
  }

  async function createGroup() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const pct =
        newPct.trim() === "" ? null : Number(newPct.replace(",", "."));
      const res = await fetch("/api/merchant/customer-groups/sr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          percentDiscount: pct,
          role: "bolt",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Létrehozás sikertelen");
      setMessage(data.message || "Kész.");
      setShowNew(false);
      setNewName("");
      setNewPct("");
      await loadGroups();
      if (data.group?.id) {
        setGroupId(data.group.id);
        setWorkTab("rule");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Létrehozás sikertelen");
    } finally {
      setCreating(false);
    }
  }

  async function bulkOp(
    op: "percent_off_list" | "cost_plus" | "clear",
    value?: number,
    scope: BulkScope = "selected",
  ) {
    if (!groupId) return;
    const useCat = scope === "category" && categoryInnerId != null;
    const useMfr = scope === "manufacturer" && manufacturerInnerId != null;
    if (!useCat && !useMfr && selected.size === 0) return;

    const catLabel =
      categories.find((c) => c.innerId === categoryInnerId)?.label ??
      "kategória";
    const mfrName =
      manufacturers.find((m) => m.innerId === manufacturerInnerId)?.name ??
      "márka";
    const countLabel = useCat
      ? `„${catLabel}” (${filteredTotal} termék, max 200 / kérés)`
      : useMfr
        ? `„${mfrName}” (${filteredTotal} termék, max 200 / kérés)`
        : `${selected.size} termék`;

    if (op === "percent_off_list" && value != null) {
      if (!window.confirm(`${countLabel}: listaár −${value}% fix árként.`))
        return;
    }
    if (op === "cost_plus" && value != null) {
      if (
        !window.confirm(
          `${countLabel}: beszerzés +${value}% → fix (ahol van beszerzés).`,
        )
      )
        return;
    }
    if (op === "clear") {
      if (!window.confirm(`${countLabel}: törlöd a fix árat?`)) return;
    }

    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/prices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          ...(useCat
            ? { categoryInnerId }
            : useMfr
              ? { manufacturerInnerId }
              : { productInnerIds: [...selected] }),
          op,
          value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tömeges mentés sikertelen");
      const errN = Array.isArray(data.errors) ? data.errors.length : 0;
      setMessage(
        errN > 0
          ? `${data.message || "Kész."} ${errN} kihagyva.`
          : data.message || "Kész.",
      );
      setSelected(new Set());
      await loadPrices({
        groupId,
        q,
        page,
        manufacturerInnerId,
        categoryInnerId,
        ownOnly,
        tiersOnly,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tömeges mentés sikertelen");
    }
  }

  async function bulkTiersOp(
    scope: BulkScope = "selected",
    opts?: { clear?: boolean; fromSku?: string | null },
  ) {
    if (!groupId) return;
    const useCat = scope === "category" && categoryInnerId != null;
    const useMfr = scope === "manufacturer" && manufacturerInnerId != null;
    if (!useCat && !useMfr && selected.size === 0) return;

    const clear = Boolean(opts?.clear);
    let tiersPayload: {
      minQty: number;
      priceNet?: number;
      percentOffList?: number;
    }[] = [];

    if (!clear) {
      if (opts?.fromSku) {
        const src = rows.find((r) => r.sku === opts.fromSku);
        if (!src?.productInnerId) {
          setError("Nincs forrás termék a másoláshoz (nyiss sávot egy soron).");
          return;
        }
        try {
          const res = await fetch(
            `/api/merchant/prices/tiers?groupId=${encodeURIComponent(groupId)}&productInnerId=${src.productInnerId}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Forrás sávok hibásak");
          const tiers = Array.isArray(data.tiers) ? data.tiers : [];
          if (!tiers.length) {
            setError("A forrás terméken nincs sáv.");
            return;
          }
          tiersPayload = tiers.map(
            (t: { minQty: number; priceNet: number }) => ({
              minQty: t.minQty,
              priceNet: t.priceNet,
            }),
          );
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Forrás sávok betöltése sikertelen",
          );
          return;
        }
      } else {
        tiersPayload = bulkTierDrafts
          .map((d) => {
            const minQty = Number(String(d.minQty).replace(",", "."));
            if (!Number.isFinite(minQty) || minQty < 1) return null;
            if (bulkTierMode === "pct") {
              const pct = Number(String(d.pct).replace(",", "."));
              if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
              return { minQty: Math.round(minQty), percentOffList: pct };
            }
            const priceNet = Number(
              String(d.priceNet).replace(/\s/g, "").replace(",", "."),
            );
            if (!Number.isFinite(priceNet) || priceNet < 0) return null;
            return {
              minQty: Math.round(minQty),
              priceNet: Math.round(priceNet),
            };
          })
          .filter((t): t is NonNullable<typeof t> => t != null);
        if (!tiersPayload.length) {
          setError("Adj meg legalább egy sávot (db + Ft vagy −%).");
          return;
        }
      }
    }

    const catLabel =
      categories.find((c) => c.innerId === categoryInnerId)?.label ??
      "kategória";
    const mfrName =
      manufacturers.find((m) => m.innerId === manufacturerInnerId)?.name ??
      "márka";
    const countLabel = useCat
      ? `„${catLabel}” (max 40 / kérés)`
      : useMfr
        ? `„${mfrName}” (max 40 / kérés)`
        : `${selected.size} termék`;

    const summary = clear
      ? `${countLabel}: sávok törlése.`
      : opts?.fromSku
        ? `${countLabel}: sávok másolása erről: ${opts.fromSku}.`
        : `${countLabel}: ${tiersPayload
            .map((t) =>
              t.percentOffList != null
                ? `${t.minQty}+ → lista −${t.percentOffList}%`
                : `${t.minQty}+ → ${t.priceNet} Ft`,
            )
            .join(", ")}. Felülírja a régi sávokat.`;

    if (!window.confirm(summary)) return;

    setBulkTiersBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/prices/tiers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          ...(useCat
            ? { categoryInnerId }
            : useMfr
              ? { manufacturerInnerId }
              : { productInnerIds: [...selected] }),
          clear,
          tiers: clear ? [] : tiersPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sáv bulk sikertelen");
      const fail = Number(data.failed) || 0;
      setMessage(
        fail > 0
          ? `${data.succeeded ?? 0} ok, ${fail} hiba.`
          : `${data.succeeded ?? 0} termék sávja kész.`,
      );
      if (!useCat && !useMfr) setSelected(new Set());
      await loadPrices({
        groupId,
        q,
        page,
        manufacturerInnerId,
        categoryInnerId,
        ownOnly,
        tiersOnly,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sáv bulk sikertelen");
    } finally {
      setBulkTiersBusy(false);
    }
  }

  async function exportFixCsv() {
    if (!groupId) return;
    setExporting(true);
    setError(null);
    try {
      const all: PriceRow[] = [];
      let p = 0;
      let pages = 1;
      while (p < pages && p < 40) {
        const params = new URLSearchParams({
          groupId,
          page: String(p),
          limit: "100",
          ownOnly: "1",
        });
        const res = await fetch(`/api/merchant/prices?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Export sikertelen");
        all.push(...((data.rows || []) as PriceRow[]));
        pages = Number(data.pageCount) || 1;
        p += 1;
      }
      const safe = (groupName || "csoport").replace(/[^\w\-]+/g, "_");
      downloadCsv(
        `arak-fix-${safe}.csv`,
        rowsToCsvMatrix(all),
      );
      setMessage(`${all.length} fix ár exportálva.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export sikertelen");
    } finally {
      setExporting(false);
    }
  }

  function exportVisibleCsv() {
    const safe = (groupName || "csoport").replace(/[^\w\-]+/g, "_");
    downloadCsv(`arak-oldal-${safe}.csv`, rowsToCsvMatrix(rows));
    setMessage(`${rows.length} sor exportálva (ez az oldal).`);
  }

  const displayRows = rows;
  const visibleSelectableIds = displayRows
    .map((r) => r.productInnerId)
    .filter((id): id is number => id != null);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selected.has(id));
  const selectedCount = selected.size;
  const displayPct = editPct > 0 ? editPct : percentDiscount;
  const selectedMfr = manufacturers.find(
    (m) => m.innerId === manufacturerInnerId,
  );
  const selectedCat = categories.find((c) => c.innerId === categoryInnerId);

  const exampleList = 10000;
  const examplePartner =
    displayPct != null && displayPct > 0
      ? Math.round(exampleList * (1 - displayPct / 100))
      : exampleList;

  const emptyCopy =
    catalogEmpty
      ? "Először töltsd be a termékeket (Beállítások)."
      : listFilter === "own"
        ? "Ebben a csoportban nincs fix áras termék."
        : listFilter === "tiers"
          ? "Ebben a csoportban még nincs sávos termék."
          : categoryInnerId != null ||
              manufacturerInnerId != null ||
              q.trim()
            ? "Nincs találat a szűrőre."
            : "Nincs termék.";

  function selectGroup(id: string) {
    setGroupId(id);
    setPage(0);
    setSelected(new Set());
    setEditingSku(null);
    setTiersSku(null);
    setCategoryInnerId(null);
    setManufacturerInnerId(null);
    tierBadgeBySku.current.clear();
  }

  async function removeGroup(g: GroupDto, force = false) {
    if (g.isDefault) {
      setError("Az alap csoportot nem törölheted.");
      return;
    }
    const missing = Boolean(g.missingFromShop);
    const label = g.name || "csoport";
    if (!force) {
      const ok = window.confirm(
        missing
          ? `„${label}” már nincs a boltban.\n\nEltávolítod a portálból? (helyi ár-/sáv-tükör is törlődik)`
          : `„${label}” törlése a boltból és a portálból?\n\nA csoport fix árai és sávjai is törlődhetnek.`,
      );
      if (!ok) return;
    }

    const key = g.groupId || `inner:${g.innerId}`;
    setRemovingGroupKey(key);
    setError(null);
    setMessage(null);
    try {
      const run = async (withForce: boolean) => {
        const params = new URLSearchParams();
        if (g.groupId) params.set("id", g.groupId);
        params.set("innerId", String(g.innerId));
        if (withForce) params.set("forcePrices", "1");
        return fetch(`/api/merchant/customer-groups/sr?${params}`, {
          method: "DELETE",
        });
      };

      let res = await run(force);
      let data = await res.json();
      if (res.status === 409 && data.needsForce && !force) {
        const again = window.confirm(
          `${data.error || "Van kapcsolódó ár / sáv."}\n\nTörölöd ezeket is a boltból?`,
        );
        if (!again) return;
        res = await run(true);
        data = await res.json();
      }
      if (!res.ok) throw new Error(data.error || "Törlés sikertelen");
      setMessage(data.message || "Kész.");
      if (g.groupId && groupId === g.groupId) {
        setGroupId("");
        setRows([]);
      }
      await loadGroups();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Törlés sikertelen");
    } finally {
      setRemovingGroupKey(null);
    }
  }

  const tabBtn = (id: WorkTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => {
        setWorkTab(id);
        setPage(0);
        setSelected(new Set());
        setEditingSku(null);
        setTiersSku(null);
        if (id === "exceptions" || id === "tiers") setListFilter("all");
      }}
      className={
        workTab === id
          ? "cursor-pointer border-b-2 border-accent px-3 py-2 text-[13px] font-semibold text-accent"
          : "cursor-pointer border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-faint hover:text-text"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-bg">
      {showNew ? (
        <div className="border-b border-line-strong bg-surface px-4 py-2 md:px-6">
          <div className="flex flex-wrap gap-2">
            <input
              className="tn-input h-8 min-w-[120px] flex-1 text-[12px]"
              placeholder="Csoport neve"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="tn-input h-8 w-16 text-[12px]"
              placeholder="−%"
              inputMode="decimal"
              value={newPct}
              onChange={(e) => setNewPct(e.target.value)}
            />
            <button
              type="button"
              disabled={creating || newName.trim().length < 2}
              onClick={() => void createGroup()}
              className="tn-btn tn-btn-primary h-8 cursor-pointer px-3 text-[12px] disabled:opacity-50"
            >
              {creating ? "…" : "OK"}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="h-8 cursor-pointer px-2 text-[12px] font-semibold text-faint"
            >
              Mégse
            </button>
          </div>
        </div>
      ) : null}

      {(error || message) && (
        <div className="border-b border-line-strong px-4 py-1.5 md:px-6">
          {error ? (
            <p className="text-[12px] font-medium text-danger">{error}</p>
          ) : null}
          {message ? (
            <p className="text-[12px] font-medium text-ok">{message}</p>
          ) : null}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-line-strong md:w-[220px] md:border-b-0 md:border-r">
          <div className="hidden items-center justify-between px-3 pt-3 md:flex">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
              Kinek?
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-visible">
            {groups.map((g) => (
              <GroupPick
                key={g.innerId}
                group={g}
                active={g.groupId === groupId}
                onSelect={() => {
                  if (g.groupId) selectGroup(g.groupId);
                }}
                onOpenTiers={
                  g.groupId && (g.tierProductCount ?? 0) > 0
                    ? () => {
                        if (g.groupId) selectGroup(g.groupId);
                        setWorkTab("tiers");
                        setListFilter("tiers");
                        setPage(0);
                      }
                    : undefined
                }
                removing={
                  removingGroupKey === (g.groupId || `inner:${g.innerId}`)
                }
                onRemove={() => void removeGroup(g)}
              />
            ))}
          </div>
          <div className="border-t border-line-strong p-2">
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="h-8 w-full cursor-pointer border border-line-strong text-[12px] font-semibold text-text hover:bg-surface-2"
            >
              + Csoport
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {!groupId ? (
            <p className="px-4 py-10 text-center text-[13px] text-faint">
              Válassz vagy hozz létre vevőcsoportot.
            </p>
          ) : groupMissing ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-4 px-6 py-10 md:px-10">
              <p className="inline-flex bg-[rgba(163,45,45,.1)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-danger">
                Hiányzik a boltból
              </p>
              <h3 className="text-[18px] font-semibold text-text">
                {selectedGroup?.name || "Csoport"}
              </h3>
              <p className="max-w-md text-[13px] leading-relaxed text-faint">
                Ez a vevőcsoport már nincs a Shoprenterben (valószínűleg ott
                törölték). A portálon megmaradt a helyi lista és az ár-/sáv-tükör.
                Árazni már nem lehet. Távolítsd el a portálból.
              </p>
              <button
                type="button"
                disabled={
                  removingGroupKey ===
                  (selectedGroup?.groupId ||
                    `inner:${selectedGroup?.innerId ?? 0}`)
                }
                onClick={() => {
                  if (selectedGroup) void removeGroup(selectedGroup);
                }}
                className="h-9 cursor-pointer border border-danger bg-surface px-4 text-[12px] font-semibold text-danger hover:bg-[rgba(163,45,45,.06)] disabled:opacity-50"
              >
                Eltávolítás a portálból
              </button>
            </div>
          ) : (
            <>
              {/* Fülek */}
              <div className="flex gap-1 border-b border-line-strong px-2 md:px-4">
                {tabBtn("rule", "Szabály")}
                {tabBtn("exceptions", "Kivételek")}
                {tabBtn("tiers", "Sávok")}
              </div>

              {/* Status bar */}
              <div className="border-b border-line-strong bg-surface-2 px-4 py-2.5 md:px-6">
                <p className="text-[13px] text-text">
                  <span className="font-semibold">{groupName || "Csoport"}:</span>{" "}
                  {displayPct != null && displayPct > 0 ? (
                    <>
                      lista <span className="font-semibold">−{displayPct}%</span>
                    </>
                  ) : (
                    <>nincs csoport kedvezmény</>
                  )}
                  .{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setWorkTab("exceptions");
                      setListFilter("own");
                      setPage(0);
                    }}
                    className="cursor-pointer font-semibold text-accent hover:underline"
                  >
                    {ownPriceCount} fix
                  </button>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => {
                      setWorkTab("tiers");
                      setListFilter("tiers");
                      setPage(0);
                    }}
                    className="cursor-pointer font-semibold text-accent hover:underline"
                  >
                    {tierProductCount} sávos
                  </button>
                  {catalogCount > 0 ? (
                    <span className="text-faint">
                      {" "}
                      · {catalogCount.toLocaleString("hu-HU")} termék
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  Fix ár felülírja a −%-ot. Sáv a mennyiségre vonatkozik (fix
                  nélkül).
                </p>
              </div>

              {/* —— SZABÁLY —— */}
              {workTab === "rule" ? (
                <div className="flex-1 overflow-auto px-4 py-8 md:px-8">
                  <div className="mx-auto max-w-lg">
                    <h3 className="text-[18px] font-semibold text-text">
                      Kedvezmény az egész listára
                    </h3>
                    <p className="mt-1 text-[13px] text-faint">
                      Minden termékre vonatkozik, kivéve a fix árasakat.
                    </p>

                    <div className="mt-8 flex items-end justify-between gap-4">
                      <span className="text-[40px] font-bold tabular-nums leading-none text-text">
                        −{editPct}%
                      </span>
                      {savingPct ? (
                        <span className="text-[12px] text-faint">Mentés…</span>
                      ) : (
                        <span className="text-[12px] text-ok">Mentve</span>
                      )}
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={editPct}
                      disabled={savingPct}
                      onChange={(e) => handlePctChange(Number(e.target.value))}
                      className="mt-4 h-2 w-full cursor-pointer accent-accent"
                      aria-label="Csoport kedvezmény"
                    />

                    <div className="mt-8 border border-line-strong bg-surface p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                        Példa
                      </p>
                      <p className="mt-2 text-[14px] text-text">
                        Bolti{" "}
                        <span className="font-semibold tabular-nums">
                          {formatHuf(exampleList)}
                        </span>
                        {" → partner "}
                        <span className="font-semibold tabular-nums text-accent">
                          {formatHuf(examplePartner)}
                        </span>
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkTab("exceptions");
                          setListFilter("own");
                        }}
                        className="h-9 cursor-pointer border border-line-strong bg-surface px-3 text-[12px] font-semibold hover:bg-surface-2"
                      >
                        Kivételek ({ownPriceCount}) →
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWorkTab("tiers");
                          setListFilter("all");
                        }}
                        className="h-9 cursor-pointer border border-line-strong bg-surface px-3 text-[12px] font-semibold hover:bg-surface-2"
                      >
                        Mennyiségi sávok ({tierProductCount}) →
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* —— KIVÉTELEK / SÁVOK közös toolbar —— */}
              {needsProductList ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-line-strong px-3 py-1 md:px-4">
                    {workTab === "exceptions" ? (
                      <div className="inline-flex border border-line-strong">
                        <button
                          type="button"
                          onClick={() => {
                            setListFilter("all");
                            setPage(0);
                          }}
                          className={
                            listFilter === "all"
                              ? "h-7 cursor-pointer bg-accent px-2.5 text-[11px] font-semibold text-white"
                              : "h-7 cursor-pointer px-2.5 text-[11px] font-semibold text-faint"
                          }
                        >
                          Összes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setListFilter("own");
                            setPage(0);
                          }}
                          className={
                            listFilter === "own"
                              ? "h-7 cursor-pointer bg-accent px-2.5 text-[11px] font-semibold text-white"
                              : "h-7 cursor-pointer px-2.5 text-[11px] font-semibold text-faint"
                          }
                        >
                          Csak fix ({ownPriceCount})
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex border border-line-strong">
                        <button
                          type="button"
                          onClick={() => {
                            setListFilter("all");
                            setPage(0);
                          }}
                          className={
                            listFilter === "all"
                              ? "h-7 cursor-pointer bg-accent px-2.5 text-[11px] font-semibold text-white"
                              : "h-7 cursor-pointer px-2.5 text-[11px] font-semibold text-faint"
                          }
                        >
                          Összes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setListFilter("tiers");
                            setPage(0);
                          }}
                          className={
                            listFilter === "tiers"
                              ? "h-7 cursor-pointer bg-accent px-2.5 text-[11px] font-semibold text-white"
                              : "h-7 cursor-pointer px-2.5 text-[11px] font-semibold text-faint"
                          }
                        >
                          Csak sávos ({tierProductCount})
                        </button>
                      </div>
                    )}

                    <PaperSelect
                      value={
                        categoryInnerId != null ? String(categoryInnerId) : ""
                      }
                      onChange={(v) => {
                        setCategoryInnerId(v ? Number(v) : null);
                        setPage(0);
                        setSelected(new Set());
                      }}
                      options={categories.map((c) => ({
                        value: String(c.innerId),
                        label:
                          c.productCount > 0
                            ? `${c.label} (${c.productCount})`
                            : c.label,
                      }))}
                      emptyLabel="Minden kategória"
                      ariaLabel="Kategória"
                      size="sm"
                      denseFrom={10}
                      maxWidth={220}
                      className="w-full max-w-[220px]"
                    />

                    <PaperSelect
                      value={
                        manufacturerInnerId != null
                          ? String(manufacturerInnerId)
                          : ""
                      }
                      onChange={(v) => {
                        setManufacturerInnerId(v ? Number(v) : null);
                        setPage(0);
                        setSelected(new Set());
                      }}
                      options={manufacturers.map((m) => ({
                        value: String(m.innerId),
                        label: `${m.name} (${m.productCount})`,
                      }))}
                      emptyLabel="Márka"
                      ariaLabel="Márka"
                      size="sm"
                      denseFrom={10}
                      maxWidth={160}
                      className="w-full max-w-[160px]"
                    />

                    <input
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setPage(0);
                      }}
                      placeholder="Keresés…"
                      className="h-7 min-w-[100px] flex-1 border-[1.5px] border-line-strong bg-surface px-2 text-[12px] outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />

                    {workTab === "exceptions" ? (
                      <>
                        <label
                          className="hidden items-center gap-1 text-[10px] text-faint lg:flex"
                          title="Ennél alacsonyabb árrésnél figyelmeztetés"
                        >
                          Min. árrés
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={marginFloor}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              const v = Math.min(90, Math.max(0, Math.round(n)));
                              setMarginFloor(v);
                              try {
                                localStorage.setItem(
                                  MARGIN_FLOOR_KEY,
                                  String(v),
                                );
                              } catch {
                                /* ignore */
                              }
                            }}
                            className="h-7 w-11 border border-line-strong bg-surface px-1 text-[11px] tabular-nums"
                          />
                          %
                        </label>
                        <button
                          type="button"
                          disabled={exporting || ownPriceCount === 0}
                          onClick={() => void exportFixCsv()}
                          className="h-7 cursor-pointer border border-line-strong px-2 text-[11px] font-semibold disabled:opacity-35"
                        >
                          {exporting ? "…" : "CSV fix"}
                        </button>
                        <button
                          type="button"
                          disabled={!rows.length}
                          onClick={exportVisibleCsv}
                          className="h-7 cursor-pointer border border-line-strong px-2 text-[11px] font-semibold disabled:opacity-35"
                        >
                          CSV oldal
                        </button>
                      </>
                    ) : null}

                    <span className="text-[11px] text-faint">
                      {filteredTotal.toLocaleString("hu-HU")}
                      {selectedCat ? ` · ${selectedCat.label}` : ""}
                      {selectedMfr ? ` · ${selectedMfr.name}` : ""}
                    </span>
                  </div>

                  {workTab === "exceptions" &&
                  categories.length === 0 &&
                  catalogCount > 0 ? (
                    <div className="border-b border-line-strong px-3 py-1 md:px-4">
                      <p className="text-[11px] text-faint">
                        Kategória szűrőhöz futtass újra katalógus szinkront
                        (Beállítások), és alkalmazd a{" "}
                        <code className="text-[10px]">023_catalog_categories.sql</code>{" "}
                        migrációt.
                      </p>
                    </div>
                  ) : null}

                  {/* Kategória tömeges */}
                  {workTab === "exceptions" && categoryInnerId != null ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-line-strong bg-accent-soft/40 px-3 py-1 md:px-4">
                      <span className="text-[11px] font-semibold text-text">
                        Kategória: {selectedCat?.label ?? "…"} · {filteredTotal}{" "}
                        (max 200):
                      </span>
                      {[10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            void bulkOp("percent_off_list", pct, "category")
                          }
                          className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                        >
                          −{pct}%
                        </button>
                      ))}
                      {[15, 20, 25].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => void bulkOp("cost_plus", m, "category")}
                          className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                        >
                          Beszer+{m}%
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          void bulkOp("clear", undefined, "category")
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                      >
                        Fix törlés
                      </button>
                    </div>
                  ) : null}

                  {/* Márka tömeges — csak kivételek */}
                  {workTab === "exceptions" &&
                  manufacturerInnerId != null &&
                  categoryInnerId == null ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-line-strong bg-accent-soft/40 px-3 py-1 md:px-4">
                      <span className="text-[11px] font-semibold text-text">
                        Ezekre mind ({filteredTotal}, max 200):
                      </span>
                      {[10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            void bulkOp("percent_off_list", pct, "manufacturer")
                          }
                          className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                        >
                          −{pct}%
                        </button>
                      ))}
                      {[15, 20, 25].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            void bulkOp("cost_plus", m, "manufacturer")
                          }
                          className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                        >
                          Beszer+{m}%
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          void bulkOp("clear", undefined, "manufacturer")
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold"
                      >
                        Fix törlés
                      </button>
                    </div>
                  ) : null}

                  {/* Sávok — kategória / márka bulk */}
                  {workTab === "tiers" && categoryInnerId != null ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-line-strong bg-accent-soft/40 px-3 py-1 md:px-4">
                      <span className="text-[11px] font-semibold text-text">
                        Kategória: {selectedCat?.label ?? "…"} · sáv (max 40):
                      </span>
                      <button
                        type="button"
                        disabled={bulkTiersBusy}
                        onClick={() => void bulkTiersOp("category")}
                        className="h-7 cursor-pointer bg-accent px-2 text-[11px] font-semibold text-white disabled:opacity-40"
                      >
                        {bulkTiersBusy ? "…" : "Sáv ezekre"}
                      </button>
                      <button
                        type="button"
                        disabled={bulkTiersBusy || !tiersSku}
                        onClick={() =>
                          void bulkTiersOp("category", { fromSku: tiersSku })
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold disabled:opacity-40"
                        title={
                          tiersSku
                            ? `Másolás: ${tiersSku}`
                            : "Előbb nyiss sávot egy terméken"
                        }
                      >
                        Másold erről
                      </button>
                      <button
                        type="button"
                        disabled={bulkTiersBusy}
                        onClick={() =>
                          void bulkTiersOp("category", { clear: true })
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold disabled:opacity-40"
                      >
                        Sáv törlés
                      </button>
                    </div>
                  ) : null}
                  {workTab === "tiers" &&
                  manufacturerInnerId != null &&
                  categoryInnerId == null ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-line-strong bg-accent-soft/40 px-3 py-1 md:px-4">
                      <span className="text-[11px] font-semibold text-text">
                        Márka: {selectedMfr?.name ?? "…"} · sáv (max 40):
                      </span>
                      <button
                        type="button"
                        disabled={bulkTiersBusy}
                        onClick={() => void bulkTiersOp("manufacturer")}
                        className="h-7 cursor-pointer bg-accent px-2 text-[11px] font-semibold text-white disabled:opacity-40"
                      >
                        {bulkTiersBusy ? "…" : "Sáv ezekre"}
                      </button>
                      <button
                        type="button"
                        disabled={bulkTiersBusy || !tiersSku}
                        onClick={() =>
                          void bulkTiersOp("manufacturer", {
                            fromSku: tiersSku,
                          })
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold disabled:opacity-40"
                      >
                        Másold erről
                      </button>
                      <button
                        type="button"
                        disabled={bulkTiersBusy}
                        onClick={() =>
                          void bulkTiersOp("manufacturer", { clear: true })
                        }
                        className="h-7 cursor-pointer border border-line-strong bg-surface px-2 text-[11px] font-semibold disabled:opacity-40"
                      >
                        Sáv törlés
                      </button>
                    </div>
                  ) : null}

                  <div className="min-h-0 flex-1 overflow-auto pb-16">
                    {loading ? (
                      <TableSkeleton />
                    ) : !displayRows.length ? (
                      <p className="px-4 py-10 text-center text-[13px] text-faint">
                        {emptyCopy}
                      </p>
                    ) : (
                      <div>
                        <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-line bg-surface-2 px-3 text-[10px] font-semibold leading-tight text-faint md:px-4">
                          {workTab === "exceptions" || workTab === "tiers" ? (
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 cursor-pointer accent-accent"
                              checked={allVisibleSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelected(new Set(visibleSelectableIds));
                                } else setSelected(new Set());
                              }}
                              aria-label="Összes az oldalon"
                            />
                          ) : (
                            <span className="w-3.5" />
                          )}
                          <span className="min-w-0 flex-1">Név</span>
                          <span
                            className="hidden w-[5.5rem] shrink-0 sm:block"
                            title="Shoprenter SKU / cikkszám"
                          >
                            SKU
                          </span>
                          <span
                            className="hidden w-[6.5rem] shrink-0 md:block"
                            title="Gyártói cikkszám (model)"
                          >
                            Gyártói csz.
                          </span>
                          <span
                            className="w-[4.5rem] shrink-0 text-right"
                            title="Bolti listaár, nettó Ft"
                          >
                            Bolti
                            <span className="block font-normal opacity-80">
                              nettó
                            </span>
                          </span>
                          <span
                            className="w-[6.5rem] shrink-0 text-right"
                            title={
                              workTab === "tiers"
                                ? "Partner ár 1 db-ra, nettó Ft"
                                : "Partner ár, nettó Ft (szerkesztéskor bruttó a tooltipben)"
                            }
                          >
                            {workTab === "tiers" ? "Partner 1db" : "Partner"}
                            <span className="block font-normal opacity-80">
                              nettó
                            </span>
                          </span>
                          {workTab === "exceptions" ? (
                            <span
                              className="w-12 shrink-0 text-right"
                              title="Árrés % (partner nettó vs beszerzés)"
                            >
                              Árrés
                              <span className="block font-normal opacity-80">
                                %
                              </span>
                            </span>
                          ) : (
                            <span className="w-[4.5rem] shrink-0 text-right">
                              Sáv
                            </span>
                          )}
                        </div>

                        {displayRows.map((row) => {
                          const hasOwn =
                            row.priceSource === "own" ||
                            row.groupPriceNet != null;
                          const on =
                            row.productInnerId != null &&
                            selected.has(row.productInnerId);
                          const editing =
                            workTab === "exceptions" &&
                            editingSku === row.sku;
                          const draft = drafts[row.sku] ?? "";
                          const title =
                            row.name || row.modelNumber || row.sku;
                          const nameTip = [
                            title,
                            row.sku ? `SKU: ${row.sku}` : null,
                            row.modelNumber
                              ? `Gyártói: ${row.modelNumber}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          const tiersOpen =
                            workTab === "tiers" && tiersSku === row.sku;

                          return (
                            <div
                              key={row.sku}
                              className="border-b border-line last:border-0"
                            >
                              <div
                                className={
                                  on || tiersOpen
                                    ? "flex h-8 items-center gap-2 bg-accent-soft px-3 md:px-4"
                                    : hasOwn
                                      ? "flex h-8 items-center gap-2 border-l-[3px] border-l-accent bg-accent-soft/15 px-3 md:px-4"
                                      : "flex h-8 items-center gap-2 px-3 hover:bg-surface-2/50 md:px-4"
                                }
                              >
                                {workTab === "exceptions" ||
                                workTab === "tiers" ? (
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
                                    checked={on}
                                    disabled={row.productInnerId == null}
                                    onChange={() => {
                                      if (row.productInnerId == null) return;
                                      setSelected((prev) => {
                                        const next = new Set(prev);
                                        if (on) next.delete(row.productInnerId!);
                                        else next.add(row.productInnerId!);
                                        return next;
                                      });
                                    }}
                                    aria-label={`Kijelölés ${row.sku}`}
                                  />
                                ) : (
                                  <span className="w-3.5 shrink-0" />
                                )}

                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <HoverProductLabel
                                    title={title}
                                    imageUrl={row.imageUrl}
                                    tip={nameTip}
                                  />
                                </div>

                                <span
                                  className="hidden w-[5.5rem] shrink-0 truncate whitespace-nowrap text-[11px] tabular-nums text-faint sm:block"
                                  title={row.sku}
                                >
                                  {row.sku}
                                </span>
                                <span
                                  className="hidden w-[6.5rem] shrink-0 truncate whitespace-nowrap text-[11px] tabular-nums text-faint md:block"
                                  title={row.modelNumber ?? undefined}
                                >
                                  {row.modelNumber || "—"}
                                </span>

                                <span
                                  className="w-[4.5rem] shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-faint"
                                  title={
                                    row.listPriceGross != null
                                      ? `Bruttó ${formatHuf(row.listPriceGross)}`
                                      : undefined
                                  }
                                >
                                  {formatHuf(row.listPriceNet)}
                                </span>

                                <div className="flex w-[6.5rem] shrink-0 items-center justify-end">
                                  {editing ? (
                                    <div className="flex w-full items-center gap-0.5">
                                      <input
                                        ref={editInputRef}
                                        className="h-6 min-w-0 flex-1 border border-accent bg-surface px-1 text-right text-[11px] font-semibold tabular-nums outline-none ring-1 ring-accent/30"
                                        inputMode="decimal"
                                        disabled={savingSku === row.sku}
                                        value={draft}
                                        onChange={(e) =>
                                          setDrafts((d) => ({
                                            ...d,
                                            [row.sku]: e.target.value,
                                          }))
                                        }
                                        onBlur={() => void saveRow(row, draft)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            e.currentTarget.blur();
                                          if (e.key === "Escape") {
                                            setEditingSku(null);
                                            setDrafts((d) => ({
                                              ...d,
                                              [row.sku]:
                                                row.groupPriceNet != null
                                                  ? String(row.groupPriceNet)
                                                  : "",
                                            }));
                                          }
                                        }}
                                      />
                                      {row.costNet != null
                                        ? [20, 25].map((m) => {
                                            const sug = costPlusNet(
                                              row.costNet!,
                                              m,
                                            );
                                            if (sug == null) return null;
                                            return (
                                              <button
                                                key={m}
                                                type="button"
                                                className="shrink-0 cursor-pointer text-[9px] font-semibold text-accent hover:underline"
                                                onMouseDown={(e) =>
                                                  e.preventDefault()
                                                }
                                                onClick={() =>
                                                  setDrafts((d) => ({
                                                    ...d,
                                                    [row.sku]: String(sug),
                                                  }))
                                                }
                                              >
                                                +{m}%
                                              </button>
                                            );
                                          })
                                        : null}
                                    </div>
                                  ) : workTab === "exceptions" ? (
                                    <button
                                      type="button"
                                      disabled={row.productInnerId == null}
                                      onClick={() => {
                                        setEditingSku(row.sku);
                                        setDrafts((d) => ({
                                          ...d,
                                          [row.sku]:
                                            row.groupPriceNet != null
                                              ? String(row.groupPriceNet)
                                              : String(row.effectiveNet),
                                        }));
                                      }}
                                      title={`Partner nettó · Bruttó ${formatHuf(row.effectiveGross)}`}
                                      className="inline-flex max-w-full cursor-pointer items-center whitespace-nowrap disabled:opacity-50"
                                    >
                                      <span
                                        className={
                                          hasOwn
                                            ? "text-[12px] font-bold tabular-nums text-accent"
                                            : "text-[12px] font-bold tabular-nums text-text"
                                        }
                                      >
                                        {formatHuf(row.effectiveNet)}
                                      </span>
                                      <PricePill
                                        source={row.priceSource}
                                        pct={
                                          row.priceSource === "percent"
                                            ? row.discountPct ?? displayPct
                                            : displayPct
                                        }
                                      />
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center whitespace-nowrap">
                                      <span className="text-[12px] font-bold tabular-nums text-text">
                                        {formatHuf(row.effectiveNet)}
                                      </span>
                                      <PricePill
                                        source={row.priceSource}
                                        pct={displayPct}
                                      />
                                    </span>
                                  )}
                                </div>

                                {workTab === "exceptions" ? (
                                  <div className="flex w-12 shrink-0 justify-end">
                                    <MarginBadge
                                      pct={row.marginPct}
                                      floor={marginFloor}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex w-[4.5rem] shrink-0 justify-end">
                                    <button
                                      type="button"
                                      disabled={row.productInnerId == null}
                                      title={
                                        row.tierSummary
                                          ? `Sávok: ${row.tierSummary}`
                                          : row.tierCount
                                            ? `${row.tierCount} sáv`
                                            : "Mennyiségi sávok"
                                      }
                                      onClick={() =>
                                        setTiersSku((s) =>
                                          s === row.sku ? null : row.sku,
                                        )
                                      }
                                      className={
                                        tiersOpen
                                          ? "cursor-pointer text-[10px] font-bold text-accent"
                                          : (row.tierCount ?? 0) > 0
                                            ? "inline-flex h-6 min-w-[2.75rem] items-center justify-center bg-accent-soft px-1 text-[10px] font-bold text-accent disabled:opacity-35"
                                            : "cursor-pointer text-[10px] font-semibold text-faint hover:text-text disabled:opacity-35"
                                      }
                                    >
                                      {tiersOpen
                                        ? "×"
                                        : (row.tierCount ?? 0) > 0
                                          ? `${row.tierCount} sáv`
                                          : "Sáv"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {tiersOpen &&
                              row.productInnerId != null &&
                              groupId ? (
                                <VolumeTiersPanel
                                  groupId={groupId}
                                  productInnerId={row.productInnerId}
                                  listPriceNet={row.listPriceNet}
                                  groupPercent={
                                    displayPct != null && displayPct > 0
                                      ? displayPct
                                      : null
                                  }
                                  ownGroupNet={row.groupPriceNet}
                                  costNet={row.costNet}
                                  onClose={() => setTiersSku(null)}
                                  onSaved={({ tierCount, tierSummary }) => {
                                    if (tierCount > 0) {
                                      tierBadgeBySku.current.set(row.sku, {
                                        tierCount,
                                        tierSummary,
                                      });
                                    } else {
                                      tierBadgeBySku.current.delete(row.sku);
                                    }
                                    if (tiersOnly && tierCount === 0) {
                                      setTiersSku(null);
                                      void loadPrices({
                                        groupId,
                                        q,
                                        page,
                                        manufacturerInnerId,
                                        categoryInnerId,
                                        ownOnly,
                                        tiersOnly: true,
                                      });
                                      return;
                                    }
                                    setRows((prev) =>
                                      prev.map((r) =>
                                        r.sku === row.sku
                                          ? {
                                              ...r,
                                              tierCount,
                                              tierSummary,
                                            }
                                          : r,
                                      ),
                                    );
                                    setTierProductCount((prev) => {
                                      const had =
                                        (row.tierCount ?? 0) > 0;
                                      const has = tierCount > 0;
                                      let next = prev;
                                      if (!had && has) next = prev + 1;
                                      else if (had && !has)
                                        next = Math.max(0, prev - 1);
                                      setGroups((gs) =>
                                        gs.map((g) =>
                                          g.groupId === groupId
                                            ? { ...g, tierProductCount: next }
                                            : g,
                                        ),
                                      );
                                      return next;
                                    });
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!loading && pageCount > 1 ? (
                    <div className="flex h-8 items-center justify-between border-t border-line-strong px-3 md:px-4">
                      <button
                        type="button"
                        disabled={page <= 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="cursor-pointer text-[11px] font-semibold disabled:opacity-35"
                      >
                        ←
                      </button>
                      <span className="text-[10px] tabular-nums text-faint">
                        {page + 1}/{pageCount} · {filteredTotal} termék
                      </span>
                      <button
                        type="button"
                        disabled={page + 1 >= pageCount}
                        onClick={() => setPage((p) => p + 1)}
                        className="cursor-pointer text-[11px] font-semibold disabled:opacity-35"
                      >
                        →
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Sticky bulk — kivételek */}
      {workTab === "exceptions" && selectedCount > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg/95 px-3 py-1.5 backdrop-blur-xl md:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold">
              {selectedCount} kijelölve
            </span>
            {[10, 15, 20].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => void bulkOp("percent_off_list", pct)}
                className="inline-flex h-7 cursor-pointer items-center bg-accent px-2 text-[11px] font-semibold text-white"
              >
                −{pct}%
              </button>
            ))}
            {[15, 20, 25].map((m) => (
              <button
                key={`c${m}`}
                type="button"
                onClick={() => void bulkOp("cost_plus", m)}
                className="inline-flex h-7 cursor-pointer items-center border border-line-strong px-2 text-[11px] font-semibold"
              >
                Beszer+{m}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => void bulkOp("clear")}
              className="inline-flex h-7 cursor-pointer items-center border border-line-strong px-2 text-[11px] font-semibold"
            >
              Fix törlés
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-[11px] font-semibold text-faint"
            >
              Mégse
            </button>
          </div>
        </div>
      ) : null}

      {/* Sticky bulk — sávok (A+D): kijelölés vagy kategória/márka szűrő */}
      {workTab === "tiers" &&
      (selectedCount > 0 ||
        categoryInnerId != null ||
        manufacturerInnerId != null) ? (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg/95 px-3 py-2 backdrop-blur-xl md:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold">
              {selectedCount > 0
                ? `${selectedCount} kijelölve · sáv`
                : categoryInnerId != null
                  ? `Kategória · sáv sablon`
                  : `Márka · sáv sablon`}
            </span>
            <div className="inline-flex border border-line-strong">
              <button
                type="button"
                onClick={() => setBulkTierMode("pct")}
                className={
                  bulkTierMode === "pct"
                    ? "h-7 cursor-pointer bg-accent px-2 text-[11px] font-semibold text-white"
                    : "h-7 cursor-pointer px-2 text-[11px] font-semibold text-faint"
                }
              >
                lista −%
              </button>
              <button
                type="button"
                onClick={() => setBulkTierMode("abs")}
                className={
                  bulkTierMode === "abs"
                    ? "h-7 cursor-pointer bg-accent px-2 text-[11px] font-semibold text-white"
                    : "h-7 cursor-pointer px-2 text-[11px] font-semibold text-faint"
                }
              >
                Ft
              </button>
            </div>
            {bulkTierDrafts.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <input
                  className="h-7 w-12 border border-line-strong bg-surface px-1 text-[11px] tabular-nums outline-none"
                  inputMode="numeric"
                  value={d.minQty}
                  aria-label={`Sáv ${i + 1} min db`}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBulkTierDrafts((prev) =>
                      prev.map((row, j) =>
                        j === i ? { ...row, minQty: v } : row,
                      ),
                    );
                  }}
                />
                <span className="text-[10px] text-faint">+</span>
                {bulkTierMode === "pct" ? (
                  <>
                    <span className="text-[10px] text-faint">−</span>
                    <input
                      className="h-7 w-11 border border-line-strong bg-surface px-1 text-[11px] tabular-nums outline-none"
                      inputMode="decimal"
                      value={d.pct}
                      aria-label={`Sáv ${i + 1} %`}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBulkTierDrafts((prev) =>
                          prev.map((row, j) =>
                            j === i ? { ...row, pct: v } : row,
                          ),
                        );
                      }}
                    />
                    <span className="text-[10px] text-faint">%</span>
                  </>
                ) : (
                  <input
                    className="h-7 w-20 border border-line-strong bg-surface px-1 text-[11px] tabular-nums outline-none"
                    inputMode="decimal"
                    value={d.priceNet}
                    aria-label={`Sáv ${i + 1} nettó Ft`}
                    placeholder="Ft"
                    onChange={(e) => {
                      const v = e.target.value;
                      setBulkTierDrafts((prev) =>
                        prev.map((row, j) =>
                          j === i ? { ...row, priceNet: v } : row,
                        ),
                      );
                    }}
                  />
                )}
                {bulkTierDrafts.length > 1 ? (
                  <button
                    type="button"
                    className="cursor-pointer text-[11px] text-faint"
                    onClick={() =>
                      setBulkTierDrafts((prev) =>
                        prev.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {bulkTierDrafts.length < 3 ? (
              <button
                type="button"
                className="h-7 cursor-pointer border border-line-strong px-2 text-[11px] font-semibold"
                onClick={() =>
                  setBulkTierDrafts((prev) => [
                    ...prev,
                    {
                      minQty: String(10 * (prev.length + 1)),
                      priceNet: "",
                      pct: String(10 + prev.length * 5),
                    },
                  ])
                }
              >
                + sáv
              </button>
            ) : null}
            {selectedCount > 0 ? (
              <>
                <button
                  type="button"
                  disabled={bulkTiersBusy}
                  onClick={() => void bulkTiersOp("selected")}
                  className="inline-flex h-7 cursor-pointer items-center bg-accent px-2.5 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  {bulkTiersBusy ? "…" : "Sáv ezekre"}
                </button>
                <button
                  type="button"
                  disabled={bulkTiersBusy || !tiersSku}
                  onClick={() =>
                    void bulkTiersOp("selected", { fromSku: tiersSku })
                  }
                  className="inline-flex h-7 cursor-pointer items-center border border-line-strong px-2 text-[11px] font-semibold disabled:opacity-40"
                  title={
                    tiersSku
                      ? `Másolás: ${tiersSku}`
                      : "Előbb nyiss sávot egy terméken (Sáv gomb)"
                  }
                >
                  Másold erről
                </button>
                <button
                  type="button"
                  disabled={bulkTiersBusy}
                  onClick={() => void bulkTiersOp("selected", { clear: true })}
                  className="inline-flex h-7 cursor-pointer items-center border border-line-strong px-2 text-[11px] font-semibold disabled:opacity-40"
                >
                  Sáv törlés
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-[11px] font-semibold text-faint"
                >
                  Mégse
                </button>
              </>
            ) : (
              <span className="text-[10px] text-faint">
                Alkalmazás: fenti „Sáv ezekre” a kategória / márka sávon
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
