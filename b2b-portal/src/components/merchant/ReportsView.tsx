"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChannelDonut,
  GroupBarList,
  HealthTracker,
  RevenueAreaChart,
  SkuBarChart,
} from "@/components/merchant/ReportCharts";
import { downloadShopReportXlsx } from "@/lib/merchant/report-export";
import type { ReportMonths, ShopReport } from "@/lib/merchant/shop-report";

type ChannelFilter = "all" | "widget" | "store";

const RANGE_OPTS: { months: ReportMonths; label: string }[] = [
  { months: 3, label: "3 hó" },
  { months: 6, label: "6 hó" },
  { months: 12, label: "12 hó" },
  { months: 24, label: "24 hó" },
];

function deltaClass(pct: number | null) {
  if (pct == null) return "text-faint";
  if (pct >= 0) return "text-ok font-semibold";
  return "text-danger font-semibold";
}

function deltaText(pct: number | null) {
  if (pct == null) return "—";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function pct(n: number | null) {
  return n == null ? "—" : `${n}%`;
}

function emptyWatchlist(): ShopReport["watchlist"] {
  return { sleeping: [], declining: [] };
}

function emptyPartnerTotals(report: ShopReport): ShopReport["partnerTotals"] {
  return {
    spent: report.mix.partnerSpent,
    spentFormatted: report.mix.partnerSpentFormatted,
    orderCount: report.mix.partnerOrderCount,
    aov:
      report.mix.partnerOrderCount > 0
        ? Math.round(report.mix.partnerSpent / report.mix.partnerOrderCount)
        : 0,
    aovFormatted:
      report.mix.partnerOrderCount > 0
        ? report.mix.partnerSpentFormatted
        : "—",
    buyers: report.mix.partnerBuyers,
  };
}

function normalizeReport(raw: ShopReport): ShopReport {
  const trend = (raw.trend || []).map((t) => ({
    ...t,
    partnerSpent: t.partnerSpent ?? 0,
    newcomerSpent: t.newcomerSpent ?? 0,
    guestSpent: t.guestSpent ?? 0,
    otherSpent: t.otherSpent ?? 0,
  }));
  return {
    ...raw,
    trend,
    partnerTotals: raw.partnerTotals ?? emptyPartnerTotals(raw),
    watchlist: raw.watchlist ?? emptyWatchlist(),
    topPartners: (raw.topPartners || []).map((p) => ({
      ...p,
      groupInnerId: p.groupInnerId ?? null,
    })),
  };
}

export function ReportsView() {
  const [months, setMonths] = useState<ReportMonths>(6);
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [groupId, setGroupId] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<ShopReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "db" | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [coverageHint, setCoverageHint] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (m: ReportMonths) => {
    setLoading(true);
    setProductsLoading(false);
    setError(null);
    setCoverageHint(null);
    try {
      const res = await fetch(
        `/api/merchant/reports?months=${m}&phase=summary`,
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: ShopReport;
        source?: "live" | "db";
        syncedAt?: string | null;
        liveFallback?: boolean;
        coverageHint?: string;
      };
      if (!res.ok) throw new Error(json.error || "Riport sikertelen");
      setReport(normalizeReport(json.report as ShopReport));
      setSource(json.source ?? "live");
      setSyncedAt(json.syncedAt ?? null);
      if (json.liveFallback && json.coverageHint) {
        setCoverageHint(json.coverageHint);
      }

      const fromDb = json.source === "db";
      if (!fromDb) {
        setProductsLoading(true);
        setLoading(false);
        try {
          const pr = await fetch(
            `/api/merchant/reports?months=${m}&phase=products`,
          );
          const pj = (await pr.json()) as {
            ok?: boolean;
            error?: string;
            report?: ShopReport;
          };
          if (pr.ok && pj.report) {
            setReport(normalizeReport(pj.report));
          }
        } catch {
          /* summary already shown */
        } finally {
          setProductsLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
      setReport(null);
      setLoading(false);
    }
  }, []);

  async function kickSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/reports", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || "Sync sikertelen");
      await load(months);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync hiba");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load(months);
  }, [load, months]);

  const filteredGroups = useMemo(() => {
    if (!report) return [];
    if (groupId === "all") return report.groups;
    return report.groups.filter((g) => g.groupInnerId === groupId);
  }, [report, groupId]);

  const filteredPartners = useMemo(() => {
    if (!report) return [];
    let rows = report.topPartners;
    if (groupId !== "all") {
      rows = rows.filter((p) => p.groupInnerId === groupId);
    }
    return rows;
  }, [report, groupId]);

  const dateFilteredTrend = useMemo(() => {
    if (!report) return [];
    if (!dateFrom && !dateTo) return report.trend;
    return report.trend.filter((t) => {
      const key = t.key; // YYYY-MM
      if (dateFrom && key < dateFrom.slice(0, 7)) return false;
      if (dateTo && key > dateTo.slice(0, 7)) return false;
      return true;
    });
  }, [report, dateFrom, dateTo]);

  function onExport() {
    if (!report) return;
    setExporting(true);
    try {
      const filtered: ShopReport = {
        ...report,
        groups: filteredGroups,
        topPartners: filteredPartners,
        trend: dateFilteredTrend,
      };
      downloadShopReportXlsx(filtered);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-text">
            Riport
          </h1>
          <p className="mt-0.5 text-[12px] text-faint">
            Partner egészség · widget ROI · csoport · SKU
            {source === "db" && syncedAt
              ? ` · DB tükör · ${new Date(syncedAt).toLocaleString("hu-HU")}`
              : source === "live"
                ? " · élő Shoprenter"
                : ""}
          </p>
          {coverageHint ? (
            <p className="mt-1 text-[11px] text-warn">
              Élő Shoprenter (tükör nem elég friss). {coverageHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!report || exporting}
            onClick={onExport}
            className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold disabled:opacity-40"
          >
            {exporting ? "…" : "Excel export"}
          </button>
          {source !== "db" || coverageHint ? (
            <button
              type="button"
              disabled={loading || syncing}
              onClick={() => void kickSync()}
              className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold disabled:opacity-40"
            >
              {syncing ? "…" : "Adatok betöltése"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-[1.5px] border-line-strong bg-surface p-2">
        <div className="inline-flex gap-0.5 bg-surface-2 p-0.5">
          {RANGE_OPTS.map((r) => (
            <button
              key={r.months}
              type="button"
              onClick={() => setMonths(r.months)}
              className={
                months === r.months
                  ? "h-8 cursor-pointer bg-surface px-3 text-[12px] font-semibold text-text"
                  : "h-8 cursor-pointer px-3 text-[12px] font-medium text-faint hover:text-text"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-[11px] text-faint">
          Tól
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 border-[1.5px] border-line bg-surface px-2 text-[12px] text-text"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-faint">
          Ig
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 border-[1.5px] border-line bg-surface px-2 text-[12px] text-text"
          />
        </label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as ChannelFilter)}
          className="h-8 cursor-pointer border-[1.5px] border-line bg-surface px-2 text-[12px]"
          aria-label="Csatorna"
        >
          <option value="all">Minden csatorna</option>
          <option value="widget">Csak widget</option>
          <option value="store">Csak bolt</option>
        </select>
        <select
          value={groupId === "all" ? "all" : String(groupId)}
          onChange={(e) =>
            setGroupId(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          className="h-8 min-w-[140px] cursor-pointer border-[1.5px] border-line bg-surface px-2 text-[12px]"
          aria-label="Csoport"
        >
          <option value="all">Minden csoport</option>
          {(report?.groups || []).map((g) => (
            <option key={g.groupInnerId} value={g.groupInnerId}>
              {g.name}
            </option>
          ))}
        </select>
        {(dateFrom || dateTo || channel !== "all" || groupId !== "all") && (
          <button
            type="button"
            className="h-8 cursor-pointer px-2 text-[11px] font-medium text-faint hover:text-text"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setChannel("all");
              setGroupId("all");
            }}
          >
            Szűrők törlése
          </button>
        )}
      </div>
      {channel !== "all" ? (
        <p className="mt-1 text-[11px] text-faint">
          Csatorna-szűrő: a mix / widget blokkok kiemelése — a táblák a teljes
          mintát mutatják (csoport-szűrővel).
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 border-[1.5px] border-danger bg-surface px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      {loading && !report ? (
        <p className="mt-10 text-center text-[13px] text-faint">
          Összesítő készül…
        </p>
      ) : null}

      {productsLoading ? (
        <p className="mt-2 text-[11px] text-faint">
          Termék / árrés még számolódik…
        </p>
      ) : null}

      {report ? (
        <div className="mt-4 space-y-4">
          {/* Hero KPIs — B2B first */}
          <div className="grid grid-cols-2 gap-0 border-[1.5px] border-line-strong sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Partner bevétel",
                value: report.partnerTotals.spentFormatted,
                sub: (
                  <span className="text-faint">
                    {report.partnerTotals.orderCount} rend. ·{" "}
                    {pct(report.mix.partnerPercent)}
                  </span>
                ),
              },
              {
                label: "Partner AOV",
                value: report.partnerTotals.aovFormatted,
                sub: (
                  <span className="text-faint">
                    Bolt AOV: {report.totals.aovFormatted}
                  </span>
                ),
              },
              {
                label: "Aktív partnerek",
                value: String(report.partnerGrowth.activePartnersInRange),
                sub: (
                  <span className="text-faint">
                    / {report.partnerGrowth.partnerFingerprintCount} össz.
                  </span>
                ),
              },
              {
                label: "NRR",
                value: pct(report.partnerGrowth.nrrPercent),
                sub: (
                  <span className="text-faint">
                    Partner visszatérő költés
                  </span>
                ),
              },
              {
                label: "Alvó partnerek",
                value: String(report.partnerGrowth.sleepingCount),
                sub: (
                  <span className="text-faint">
                    Nincs rendelés a tartományban
                  </span>
                ),
              },
              {
                label: "Widget @ partner",
                value: pct(report.partnerGrowth.widgetPercentOfPartner),
                sub: (
                  <span className="text-faint">
                    {report.partnerGrowth.partnerWidgetSpentFormatted}
                  </span>
                ),
              },
            ].map((k, i) => (
              <div
                key={k.label}
                className={`min-w-0 bg-surface px-3 py-3 ${
                  i > 0 ? "border-t-[1.5px] border-line-strong sm:border-t-0" : ""
                } ${i % 2 === 1 ? "border-l-[1.5px] border-line-strong" : ""} ${
                  i >= 2 ? "sm:border-l-[1.5px]" : ""
                } lg:border-l-[1.5px] lg:border-t-0 ${i === 0 ? "lg:border-l-0" : ""}`}
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {k.label}
                </p>
                <p className="mt-1 truncate text-[18px] font-semibold tabular-nums tracking-tight text-text">
                  {k.value}
                </p>
                <p className="mt-1 truncate text-[10px]">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Secondary totals */}
          <div className="grid grid-cols-1 gap-0 border-[1.5px] border-line-strong sm:grid-cols-4">
            {[
              {
                label: "Összes bevétel",
                value: report.totals.spentFormatted,
                sub: (
                  <span className={deltaClass(report.totals.deltaPercent)}>
                    {deltaText(report.totals.deltaPercent)} vs előző{" "}
                    {report.rangeMonths} hó
                  </span>
                ),
              },
              {
                label: "Rendelés",
                value: String(report.totals.orderCount),
                sub: (
                  <span className="text-faint">
                    Vevő: {report.activeBuyers}
                  </span>
                ),
              },
              {
                label: "Árrés",
                value: productsLoading
                  ? "…"
                  : pct(report.profit.marginPercent),
                sub: (
                  <span className="text-faint">
                    {report.profit.grossProfitFormatted} · lefed.{" "}
                    {pct(report.profit.coveragePercent)}
                  </span>
                ),
              },
              {
                label: "Ritmus / SKU",
                value:
                  report.partnerGrowth.medianDaysBetweenOrders != null
                    ? `${report.partnerGrowth.medianDaysBetweenOrders} nap`
                    : "—",
                sub: (
                  <span className="text-faint">
                    SKU/partner:{" "}
                    {report.partnerGrowth.avgSkuPerActivePartner ?? "—"}
                  </span>
                ),
              },
            ].map((k, i) => (
              <div
                key={k.label}
                className={`bg-surface px-4 py-3 ${i > 0 ? "border-t-[1.5px] border-line-strong sm:border-t-0 sm:border-l-[1.5px]" : ""}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {k.label}
                </p>
                <p className="mt-1 text-[16px] font-semibold tabular-nums text-text">
                  {k.value}
                </p>
                <p className="mt-1 text-[11px]">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="border-[1.5px] border-line-strong bg-surface p-4 lg:col-span-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-text">
                  Bevétel trend · {report.rangeLabel}
                </p>
                <p className="text-[11px] text-faint">
                  {report.truncated
                    ? `Minta ~${report.sampleOrderCount}`
                    : `${report.sampleOrderCount} rendelés`}
                </p>
              </div>
              <div className="mt-2">
                <RevenueAreaChart trend={dateFilteredTrend} />
              </div>
              <p className="mt-2 text-[10px] leading-snug text-faint">
                <span className="font-semibold text-text">Vendég</span> = nincs
                Shoprenter fiók (checkout vendég).{" "}
                <span className="font-semibold text-text">Új</span> = regisztrált,
                még az alap vevőcsoportban.{" "}
                <span className="font-semibold text-text">Partner</span> =
                átrakva partner csoportba.
              </p>
            </div>
            <div className="border-[1.5px] border-line-strong bg-surface p-4 lg:col-span-2">
              <p className="text-[13px] font-semibold text-text">
                Widget · Bolt
                {channel !== "all" ? (
                  <span className="ml-1 text-[11px] font-normal text-faint">
                    (szűrő: {channel})
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                Widget fact: {report.mix.widgetOrderCount} rendelés · átrakás:{" "}
                {report.movesInRange}
              </p>
              <div className="mt-3">
                <ChannelDonut
                  widgetPercent={
                    channel === "store" ? 0 : report.mix.widgetPercent
                  }
                  storePercent={
                    channel === "widget" ? 0 : report.mix.storePercent
                  }
                  widgetLabel={report.mix.widgetSpentFormatted}
                  storeLabel={report.mix.storeSpentFormatted}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-[1.5px] border-line-strong bg-surface p-4">
              <p className="text-[13px] font-semibold text-text">
                Partner egészség
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                Aktív vs alvó ujjlenyomat partnerek
              </p>
              <div className="mt-3">
                <HealthTracker
                  active={report.partnerGrowth.activePartnersInRange}
                  sleeping={report.partnerGrowth.sleepingCount}
                  total={report.partnerGrowth.partnerFingerprintCount}
                />
              </div>
            </div>
            <div className="border-[1.5px] border-line-strong bg-surface p-4">
              <p className="text-[13px] font-semibold text-text">
                Top csoportok
              </p>
              <div className="mt-3">
                <GroupBarList groups={filteredGroups} />
              </div>
            </div>
          </div>

          {/* Watchlist */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border-[1.5px] border-line-strong bg-surface">
              <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
                <p className="text-[13px] font-semibold text-text">
                  Figyelendő · zuhanó (≤ −20%)
                </p>
              </div>
              <ul className="divide-y divide-line">
                {report.watchlist.declining.length === 0 ? (
                  <li className="px-4 py-6 text-center text-[12px] text-faint">
                    Nincs jelentősen zuhanó partner.
                  </li>
                ) : (
                  report.watchlist.declining.map((p) => (
                    <li
                      key={p.key}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]"
                    >
                      <div className="min-w-0">
                        {p.customerInnerId != null ? (
                          <Link
                            href={`/vevok/${p.customerInnerId}`}
                            className="font-semibold text-text hover:underline"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-semibold">{p.name}</span>
                        )}
                        <p className="truncate text-[10px] text-faint">
                          {p.spentFormatted} · {p.orderCount} rend.
                        </p>
                      </div>
                      <span className={deltaClass(p.deltaPercent)}>
                        {deltaText(p.deltaPercent)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="border-[1.5px] border-line-strong bg-surface">
              <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
                <p className="text-[13px] font-semibold text-text">
                  Figyelendő · alvó partnerek
                </p>
              </div>
              <ul className="divide-y divide-line">
                {report.watchlist.sleeping.length === 0 ? (
                  <li className="px-4 py-6 text-center text-[12px] text-faint">
                    Nincs alvó partner a listában.
                  </li>
                ) : (
                  report.watchlist.sleeping.map((p) => (
                    <li
                      key={p.customerInnerId}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-[12px]"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/vevok/${p.customerInnerId}`}
                          className="font-semibold text-text hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.email ? (
                          <p className="truncate text-[10px] text-faint">
                            {p.email}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-medium text-warn">
                        Hallgat
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Groups table */}
          <div className="border-[1.5px] border-line-strong bg-surface">
            <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
              <p className="text-[13px] font-semibold text-text">
                Vevőcsoportok
              </p>
              <p className="text-[10px] text-faint">
                Terhelés = kedvezmény + szállítás % · NRR = most / előző
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                    <th className="px-3 py-2 text-left">Csoport</th>
                    <th className="px-2 py-2 text-right">Bevétel</th>
                    <th className="px-2 py-2 text-right">AOV</th>
                    <th className="px-2 py-2 text-right">Vevő</th>
                    <th className="px-2 py-2 text-right">NRR</th>
                    <th className="px-2 py-2 text-right">Kedv%</th>
                    <th className="px-2 py-2 text-right">Terhelés</th>
                    <th className="px-3 py-2 text-right">Widget%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-faint"
                      >
                        Nincs csoport-adat.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((g) => (
                      <tr
                        key={g.groupInnerId}
                        className="border-b border-line"
                      >
                        <td className="px-3 py-2">
                          <span className="font-semibold">{g.name}</span>
                          <span className="mt-0.5 block text-[10px] text-faint">
                            {g.isDefault
                              ? "Alap"
                              : g.role
                                ? g.role
                                : `#${g.groupInnerId}`}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">
                          {g.spentFormatted}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {g.aovFormatted}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-faint">
                          {g.buyers}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {pct(g.nrrPercent)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {pct(g.discountPercent)}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">
                          {pct(g.loadPercent)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {pct(g.widgetPercent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border-[1.5px] border-line-strong bg-surface">
              <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
                <p className="text-[13px] font-semibold text-text">
                  Top partnerek
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                      <th className="px-3 py-2 text-left">Vevő</th>
                      <th className="px-2 py-2 text-right">Rend.</th>
                      <th className="px-2 py-2 text-right">Δ</th>
                      <th className="px-3 py-2 text-right">Bevétel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-faint"
                        >
                          Nincs partner a szűrésben.
                        </td>
                      </tr>
                    ) : (
                      filteredPartners.slice(0, 15).map((p) => (
                        <tr key={p.key} className="border-b border-line">
                          <td className="px-3 py-2">
                            {p.customerInnerId != null ? (
                              <Link
                                href={`/vevok/${p.customerInnerId}`}
                                className="font-semibold hover:underline"
                              >
                                {p.name}
                              </Link>
                            ) : (
                              <span className="font-semibold">{p.name}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-faint">
                            {p.orderCount}
                          </td>
                          <td
                            className={`px-2 py-2 text-right tabular-nums ${deltaClass(p.deltaPercent)}`}
                          >
                            {deltaText(p.deltaPercent)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {p.spentFormatted}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-[1.5px] border-line-strong bg-surface">
              <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
                <p className="text-[13px] font-semibold text-text">
                  Top termékek
                </p>
                <p className="text-[10px] text-faint">{report.profit.note}</p>
              </div>
              <div className="px-3 pt-3">
                <SkuBarChart products={report.topProducts} />
              </div>
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[420px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                      <th className="px-3 py-2 text-left">Termék</th>
                      <th className="px-2 py-2 text-right">Db</th>
                      <th className="px-2 py-2 text-right">Árrés</th>
                      <th className="px-3 py-2 text-right">Bevétel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-faint"
                        >
                          {productsLoading
                            ? "Termékek betöltése…"
                            : "Nincs termék a mintában."}
                        </td>
                      </tr>
                    ) : (
                      report.topProducts.slice(0, 12).map((p) => (
                        <tr key={p.sku} className="border-b border-line">
                          <td className="px-3 py-2">
                            <span className="font-semibold">
                              {p.name || p.sku}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-faint">
                              {p.sku}
                              {p.modelNumber ? ` · ${p.modelNumber}` : ""}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-faint">
                            {p.quantity}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {p.hasCost ? pct(p.marginPercent) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {p.lineRevenueFormatted}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
