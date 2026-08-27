"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  gateFromBilling,
  NearLimitBanner,
  UpgradeBanner,
} from "@/components/merchant/PartnerUsageBar";
import { PaperSelect } from "@/components/ui/PaperSelect";
import {
  isPartnerLocked,
  isPartnerPreviewLocked,
  type PartnerGateDto,
} from "@/lib/billing/types";
import { onPlan } from "@/lib/billing/plans";
import { groupChipTone } from "@/lib/merchant/group-chip";

type ListFilter = "newcomers" | "partners" | "all";

type GroupDto = {
  innerId: number;
  groupId: string | null;
  name: string;
  isDefault: boolean;
};

type CustomerRow = {
  id: string;
  innerId: number;
  email: string;
  name: string;
  groupInnerId: number | null;
  groupName: string | null;
  isDefaultGroup?: boolean;
  isPartner?: boolean;
  totalSpent?: number;
};

type SpendSort = "spent" | "-spent" | "";

function formatSpent(n: number | undefined): string {
  const v = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${v} Ft`;
  }
}

const FILTERS: { id: ListFilter; label: string; hint: string }[] = [
  {
    id: "newcomers",
    label: "Újak",
    hint: "Alapértelmezett csoport: új regisztrálók",
  },
  {
    id: "partners",
    label: "Partnerek",
    hint: "Nem az alap csoportban: partner árazás",
  },
  { id: "all", label: "Összes", hint: "Minden vevő ezen az oldalon" },
];

export function CustomersView() {
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [list, setList] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ListFilter>("newcomers");
  const [groupFilterId, setGroupFilterId] = useState<number | "">("");
  const [spendSort, setSpendSort] = useState<SpendSort>("");
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [targetGroupId, setTargetGroupId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gate, setGate] = useState<PartnerGateDto | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    rows: {
      row: number;
      email: string;
      status: string;
      message: string;
      customerInnerId: number | null;
      toGroupInnerId: number | null;
      customerName: string | null;
    }[];
    summary: {
      total: number;
      ok: number;
      same: number;
      unknownEmail: number;
      unknownGroup: number;
      invalid: number;
    };
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/merchant/customer-groups");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Csoportok betöltése sikertelen");
    const gs = (data.groups || []) as GroupDto[];
    setGroups(gs);
    setTargetGroupId((prev) => {
      if (prev !== "" && gs.some((g) => g.innerId === prev)) return prev;
      const nonDef = gs.filter((g) => !g.isDefault);
      if (nonDef.length === 1) return nonDef[0].innerId;
      return "";
    });
  }, []);

  const loadGate = useCallback(async () => {
    const res = await fetch("/api/merchant/billing");
    const json = await res.json();
    if (!res.ok) return;
    setGate(gateFromBilling(json));
  }, []);

  const loadCustomers = useCallback(
    async (opts: {
      query: string;
      filter: ListFilter;
      page: number;
      groupInnerId: number | "";
      spendSort: SpendSort;
    }) => {
      const params = new URLSearchParams();
      if (opts.query.trim()) {
        params.set("q", opts.query.trim());
      } else {
        params.set("filter", opts.filter);
        params.set("page", String(opts.page));
        params.set("limit", "25");
        if (opts.groupInnerId !== "") {
          params.set("groupInnerId", String(opts.groupInnerId));
        }
      }
      if (opts.spendSort) params.set("sort", opts.spendSort);
      const res = await fetch(`/api/merchant/customers?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vevők betöltése sikertelen");
      setList(data.customers || []);
      setPageCount(Math.max(1, Number(data.pageCount) || 1));
    },
    [],
  );

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loadGroups();
      await loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
        spendSort,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadCustomers, q, filter, page, groupFilterId, spendSort]);

  useEffect(() => {
    setLoading(true);
    void loadGroups()
      .catch((e) => setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => {
        /* customers: a következő effect tölti */
      });
    void loadGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setError(null);
      setLoading(true);
      void loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
        spendSort,
      })
        .then(() => setSelected(new Set()))
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Keresés hiba"),
        )
        .finally(() => setLoading(false));
    }, q.trim() ? 350 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, filter, page, groupFilterId, spendSort, loadCustomers]);

  function cycleSpendSort() {
    setSpendSort((prev) => {
      if (prev === "") return "-spent";
      if (prev === "-spent") return "spent";
      return "";
    });
    setPage(0);
  }

  const unlocked = list.filter(
    (c) => !isPartnerLocked(c.isPartner, c.innerId, gate),
  );
  const allOnPageSelected =
    unlocked.length > 0 && unlocked.every((c) => selected.has(c.innerId));
  const selectedCount = selected.size;

  function toggleOne(innerId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(innerId)) next.delete(innerId);
      else next.add(innerId);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      if (unlocked.length === 0) return prev;
      const next = new Set(prev);
      if (unlocked.every((c) => next.has(c.innerId))) {
        for (const c of unlocked) next.delete(c.innerId);
      } else {
        for (const c of unlocked) next.add(c.innerId);
      }
      return next;
    });
  }

  async function runBulkMove(toId: number) {
    if (selected.size === 0) return;
    setError(null);
    setMessage(null);
    setMoving(true);
    try {
      const res = await fetch("/api/merchant/customers/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerInnerIds: [...selected],
          toGroupInnerId: toId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Átrakás sikertelen");
      setMessage(data.message || "Kész.");
      setSelected(new Set());
      await loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
        spendSort,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Átrakás sikertelen");
    } finally {
      setMoving(false);
    }
  }

  function onMoveClick() {
    if (targetGroupId === "") {
      setError("Válaszd ki, melyik csoportba kerüljenek.");
      return;
    }
    void runBulkMove(targetGroupId);
  }

  async function downloadExport() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      else {
        params.set("filter", filter);
        if (groupFilterId !== "") {
          params.set("groupInnerId", String(groupFilterId));
        }
      }
      const res = await fetch(`/api/merchant/customers/export?${params}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Export sikertelen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vevok-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Excel letöltve.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export sikertelen");
    } finally {
      setExporting(false);
    }
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const res = await fetch("/api/merchant/customers/import/template");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Sablon hiba");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vevok-import-sablon.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sablon hiba");
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setError(null);
    setImportPreview(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/merchant/customers/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import előnézet sikertelen");
      setImportPreview({
        rows: data.rows || [],
        summary: data.summary,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import hiba");
    } finally {
      setImportBusy(false);
    }
  }

  async function applyImport() {
    if (!importPreview) return;
    const moves = importPreview.rows
      .filter(
        (r) =>
          r.status === "ok" &&
          r.customerInnerId != null &&
          r.toGroupInnerId != null,
      )
      .map((r) => ({
        customerInnerId: r.customerInnerId!,
        toGroupInnerId: r.toGroupInnerId!,
      }));
    if (moves.length === 0) {
      setError("Nincs alkalmazható sor.");
      return;
    }
    if (
      !window.confirm(
        `${moves.length} vevő csoportját frissíted a boltban. Folytatod?`,
      )
    ) {
      return;
    }
    setImportBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, moves }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import sikertelen");
      setMessage(data.message || "Kész.");
      setImportPreview(null);
      setShowImport(false);
      await loadCustomers({
        query: q,
        filter,
        page,
        groupInnerId: groupFilterId,
        spendSort,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import sikertelen");
    } finally {
      setImportBusy(false);
    }
  }

  const emptyCopy = q.trim()
    ? "Nincs találat a keresésre (név / email / ID)."
    : groupFilterId !== ""
      ? "Ebben a csoportban nincs vevő ezen az oldalon."
      : filter === "newcomers"
        ? "Nincs új vevő az alap csoportban. Ha valaki regisztrál, itt jelenik meg."
        : filter === "partners"
          ? "Nincs partner ebben a listában."
          : "Nincs vevő ezen az oldalon.";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-bg">
      <div className="glass-bar sticky top-0 z-10 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-text">
              Vevők
            </p>
          </div>

          {gate?.overCap ? (
            <UpgradeBanner
              used={gate.activePartners}
              limit={gate.partnerLimit}
            />
          ) : gate?.wouldLoseOnPaid ? (
            <p className="border border-line-strong bg-surface-2 px-3 py-2 text-[12px] text-text">
              A próba alatt mind a {gate.partnerLimit}-ig látszik.{" "}
              {onPlan(gate.planLabel)} {gate.paidPartnerLimit} után a név
              elmosódik.{" "}
              <Link href="/csomag" className="font-semibold underline underline-offset-2">
                Tartsd a {gate.activePartners} vevőt
              </Link>
            </p>
          ) : gate?.warn80 && !gate.isTrial ? (
            <NearLimitBanner
              used={gate.activePartners}
              limit={gate.partnerLimit}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-none bg-surface-2 p-0.5">
              {FILTERS.map((f) => {
                const active = filter === f.id && groupFilterId === "";
                return (
                  <button
                    key={f.id}
                    type="button"
                    title={f.hint}
                    onClick={() => {
                      setFilter(f.id);
                      setGroupFilterId("");
                      setPage(0);
                      setSelected(new Set());
                    }}
                    className={
                      active
                        ? "h-8 cursor-pointer rounded-none bg-surface px-3 text-[12px] font-semibold text-text shadow-[0_0.5px_1px_rgba(26,25,23,.1)]"
                        : "h-8 cursor-pointer rounded-none px-3 text-[12px] font-medium text-faint hover:text-text"
                    }
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <PaperSelect
              value={groupFilterId === "" ? "" : String(groupFilterId)}
              onChange={(v) => {
                setGroupFilterId(v === "" ? "" : Number(v));
                setFilter("all");
                setPage(0);
                setSelected(new Set());
              }}
              options={groups.map((g) => ({
                value: String(g.innerId),
                label: g.isDefault ? `${g.name} (alap)` : g.name,
              }))}
              emptyLabel="Csoport: mind"
              ariaLabel="Csoport szűrő"
              size="md"
              denseFrom={10}
              maxWidth={200}
              className="w-full max-w-[200px]"
            />

            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Keresés: név, email vagy ID…"
              className="h-8 min-w-[180px] flex-1 rounded-none border-[1.5px] border-line-strong bg-surface px-3 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/15"
            />

            <button
              type="button"
              disabled={exporting}
              onClick={() => void downloadExport()}
              className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold disabled:opacity-40"
            >
              {exporting ? "…" : "Excel letöltés"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImport((v) => !v);
                setImportPreview(null);
              }}
              className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold"
            >
              {showImport ? "Import bezárás" : "Excel import"}
            </button>
          </div>

          {showImport ? (
            <div className="border-[1.5px] border-line-strong bg-surface p-3">
              <p className="text-[13px] font-semibold text-text">
                Csoportok Excelből
              </p>
              <p className="mt-1 text-[12px] text-faint">
                Letöltés → írd át a{" "}
                <span className="font-medium text-text">csoport</span> oszlopot
                → import. Kulcs:{" "}
                <span className="font-medium text-text">email</span>. A{" "}
                <span className="font-medium text-text">nev</span> csak
                tájékoztató.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => void downloadTemplate()}
                  className="h-8 cursor-pointer border border-line-strong px-3 text-[12px] font-semibold disabled:opacity-40"
                >
                  Sablon
                </button>
                <label className="inline-flex h-8 cursor-pointer items-center border border-line-strong bg-accent px-3 text-[12px] font-semibold text-white">
                  {importBusy ? "…" : "Fájl kiválasztása"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    disabled={importBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onImportFile(f);
                    }}
                  />
                </label>
                {importPreview && importPreview.summary.ok > 0 ? (
                  <button
                    type="button"
                    disabled={importBusy}
                    onClick={() => void applyImport()}
                    className="h-8 cursor-pointer bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                  >
                    Alkalmaz ({importPreview.summary.ok})
                  </button>
                ) : null}
              </div>
              {importPreview ? (
                <div className="mt-3">
                  <p className="text-[12px] text-faint">
                    {importPreview.summary.total} sor ·{" "}
                    <span className="text-ok">
                      {importPreview.summary.ok} ok
                    </span>
                    {importPreview.summary.same
                      ? ` · ${importPreview.summary.same} változatlan`
                      : ""}
                    {importPreview.summary.unknownEmail
                      ? ` · ${importPreview.summary.unknownEmail} ismeretlen email`
                      : ""}
                    {importPreview.summary.unknownGroup
                      ? ` · ${importPreview.summary.unknownGroup} ismeretlen csoport`
                      : ""}
                    {importPreview.summary.invalid
                      ? ` · ${importPreview.summary.invalid} hibás`
                      : ""}
                  </p>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[12px]">
                    {importPreview.rows.slice(0, 40).map((r) => (
                      <li
                        key={`${r.row}-${r.email}`}
                        className={
                          r.status === "ok"
                            ? "text-text"
                            : r.status === "same_group"
                              ? "text-faint"
                              : "text-danger"
                        }
                      >
                        <span className="text-faint">#{r.row}</span> {r.email}
                        {r.customerName ? ` · ${r.customerName}` : ""}:{" "}
                        {r.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-2 text-[12px] font-medium text-ok">{message}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-20">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="sticky top-0 z-[5] bg-bg">
            <tr className="border-b border-line-strong text-[11px] font-semibold uppercase tracking-wide text-faint">
              <th className="w-12 px-4 py-2.5 md:px-6">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  disabled={unlocked.length === 0}
                  aria-label="Összes kijelölése ezen az oldalon"
                  className="h-4 w-4 cursor-pointer accent-accent"
                />
              </th>
              <th className="px-2 py-2.5 font-semibold">Név</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                <button
                  type="button"
                  onClick={cycleSpendSort}
                  title="Rendezés összes költés szerint"
                  className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide hover:text-text"
                >
                  Költés
                  <span className="text-[10px] font-bold normal-case tracking-normal text-faint">
                    {spendSort === "-spent"
                      ? "↓"
                      : spendSort === "spent"
                        ? "↑"
                        : "↕"}
                  </span>
                </button>
              </th>
              <th className="px-4 py-2.5 font-semibold md:px-6">Csoport</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const on = selected.has(c.innerId);
              const locked = isPartnerLocked(c.isPartner, c.innerId, gate);
              const preview = isPartnerPreviewLocked(c.isPartner, c.innerId, gate);
              const groupTone = groupChipTone({
                groupInnerId: c.groupInnerId,
                groupName: c.groupName,
                isDefaultGroup: c.isDefaultGroup,
                isPartner: c.isPartner,
              });
              return (
                <tr
                  key={c.innerId}
                  onClick={() => {
                    if (!locked) toggleOne(c.innerId);
                  }}
                  className={
                    locked
                      ? "border-b border-line bg-surface"
                      : preview
                        ? "cursor-pointer border-b border-dashed border-warn bg-surface hover:bg-surface-2/60"
                        : on
                        ? "cursor-pointer border-b border-line bg-accent-soft"
                        : "cursor-pointer border-b border-line bg-surface hover:bg-surface-2/60"
                  }
                >
                  <td
                    className="px-4 py-2.5 md:px-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleOne(c.innerId)}
                      disabled={locked}
                      aria-label={`${c.name} kijelölése`}
                      className="h-4 w-4 cursor-pointer accent-accent disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-2.5 text-[13px] font-semibold text-text">
                    {locked ? (
                      <span className="inline-flex items-center gap-2 blur-[5px] select-none">
                        {c.name}
                      </span>
                    ) : preview ? (
                      <span className="relative inline-flex items-center">
                        <Link
                          href={`/vevok/${c.innerId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </span>
                    ) : (
                      <Link
                        href={`/vevok/${c.innerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    )}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2.5 text-[12px] text-faint">
                    {locked ? (
                      <span className="blur-[5px] select-none">{c.email}</span>
                    ) : (
                      c.email
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-text">
                    {locked ? (
                      <span className="blur-[5px] select-none">—</span>
                    ) : (
                      formatSpent(c.totalSpent)
                    )}
                  </td>
                  <td className="px-4 py-2.5 md:px-6">
                    {locked ? (
                      <span className="text-[12px] font-medium text-faint">
                        Tartsd a {gate?.activePartners ?? 0} vevőt, hogy lásd
                      </span>
                    ) : preview ? (
                      <span className="text-[12px] font-medium text-faint">
                        {onPlan(gate?.planLabel || "Start")} ez a név elmosódna
                      </span>
                    ) : (
                      <span
                        className={groupTone.className}
                        style={groupTone.style}
                      >
                        {c.groupName || "Nincs csoport"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && list.length === 0 ? (
          <p className="px-6 py-12 text-center text-[13px] text-faint">
            {emptyCopy}
          </p>
        ) : null}

        {loading ? (
          <p className="px-6 py-6 text-[13px] text-faint">Betöltés…</p>
        ) : null}
      </div>

      {!q.trim() && pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-line-strong bg-bg/90 px-4 py-2.5 md:px-6">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 cursor-pointer rounded-none px-3 text-[12px] font-semibold text-text disabled:opacity-35"
          >
            Előző
          </button>
          <p className="text-[12px] text-faint">
            Oldal {page + 1} / {pageCount}
          </p>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 cursor-pointer rounded-none px-3 text-[12px] font-semibold text-text disabled:opacity-35"
          >
            Következő
          </button>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg/95 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-1 text-[13px] font-semibold text-text">
              {selectedCount} kiválasztva
            </p>
            <PaperSelect
              value={targetGroupId === "" ? "" : String(targetGroupId)}
              onChange={(v) => {
                setTargetGroupId(v === "" ? "" : Number(v));
              }}
              options={groups.map((g) => ({
                value: String(g.innerId),
                label: g.isDefault ? `${g.name} (alap)` : g.name,
              }))}
              emptyLabel="Csoport…"
              ariaLabel="Cél csoport"
              size="md"
              denseFrom={10}
              maxWidth={240}
              preferPlacement="up"
              className="min-w-[160px] flex-1 sm:max-w-[240px] sm:flex-none"
            />
            <button
              type="button"
              disabled={moving || targetGroupId === ""}
              onClick={onMoveClick}
              className="inline-flex h-9 cursor-pointer items-center rounded-none bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {moving ? "…" : "Átrakás"}
            </button>
            <button
              type="button"
              disabled={moving}
              onClick={() => setSelected(new Set())}
              className="inline-flex h-9 cursor-pointer items-center rounded-none px-3 text-[13px] font-semibold text-faint hover:text-text"
            >
              Mégse
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
