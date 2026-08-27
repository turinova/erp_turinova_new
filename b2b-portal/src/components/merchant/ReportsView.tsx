"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ReportMonths = 3 | 6 | 12 | 24;

type ShopReport = {
  rangeMonths: ReportMonths;
  rangeLabel: string;
  sampleOrderCount: number;
  truncated: boolean;
  totals: {
    spentFormatted: string;
    orderCount: number;
    aovFormatted: string;
    deltaPercent: number | null;
    shippingPercent: number | null;
    discountPercent: number | null;
  };
  prev: {
    spentFormatted: string;
    orderCount: number;
  };
  partnerGrowth: {
    nrrPercent: number | null;
    sleepingCount: number;
    partnerFingerprintCount: number;
    activePartnersInRange: number;
    medianDaysBetweenOrders: number | null;
    avgSkuPerActivePartner: number | null;
    widgetPercentOfPartner: number | null;
    partnerWidgetSpentFormatted: string;
  };
  profit: {
    revenueWithCostFormatted: string;
    costTotalFormatted: string;
    grossProfitFormatted: string;
    marginPercent: number | null;
    coveragePercent: number | null;
    skuWithCost: number;
    skuTotal: number;
    note: string;
  };
  trend: {
    key: string;
    label: string;
    spent: number;
    spentFormatted: string;
    orderCount: number;
  }[];
  mix: {
    guestSpentFormatted: string;
    guestPercent: number | null;
    guestOrderCount: number;
    guestBuyers: number;
    newcomerSpentFormatted: string;
    newcomerPercent: number | null;
    newcomerOrderCount: number;
    newcomerBuyers: number;
    partnerSpentFormatted: string;
    partnerPercent: number | null;
    partnerOrderCount: number;
    partnerBuyers: number;
    otherSpentFormatted: string;
    otherPercent: number | null;
    widgetSpentFormatted: string;
    widgetOrderCount: number;
    widgetPercent: number | null;
    storeSpentFormatted: string;
    storePercent: number | null;
  };
  movesInRange: number;
  activeBuyers: number;
  groups: {
    groupInnerId: number;
    name: string;
    role: string | null;
    isDefault: boolean;
    spentFormatted: string;
    orderCount: number;
    aovFormatted: string;
    buyers: number;
    discountPercent: number | null;
    shippingPercent: number | null;
    loadPercent: number | null;
    widgetPercent: number | null;
    nrrPercent: number | null;
  }[];
  topPartners: {
    key: string;
    name: string;
    email: string | null;
    customerInnerId: number | null;
    isPartner: boolean | null;
    orderCount: number;
    spentFormatted: string;
    deltaPercent: number | null;
  }[];
  topProducts: {
    sku: string;
    modelNumber: string | null;
    name: string | null;
    quantity: number;
    lineRevenueFormatted: string;
    costTotalFormatted: string | null;
    marginPercent: number | null;
    hasCost: boolean;
  }[];
};

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

function TrendBars({ trend }: { trend: ShopReport["trend"] }) {
  if (!trend.length) {
    return (
      <p className="py-8 text-center text-[12px] text-faint">
        Nincs adat a trendhez ebben a tartományban.
      </p>
    );
  }
  const max = Math.max(...trend.map((t) => t.spent), 1);
  const plotH = 128;
  return (
    <div className="flex items-end gap-1">
      {trend.map((t) => {
        const h =
          t.spent <= 0
            ? 0
            : Math.max(3, Math.round((t.spent / max) * plotH));
        const monthShort =
          t.label.replace(/\s*20\d{2}/, "").trim() || t.label;
        return (
          <div
            key={t.key}
            className="group relative flex min-w-0 flex-1 flex-col items-center"
          >
            <div
              className="flex w-full max-w-[36px] items-end justify-center"
              style={{ height: plotH }}
            >
              <div
                className="w-full cursor-default bg-text transition-opacity group-hover:opacity-80"
                style={{ height: h }}
                aria-label={`${t.label}: ${t.spentFormatted}, ${t.orderCount} rendelés`}
              />
            </div>
            <p className="mt-1.5 w-full truncate text-center text-[9px] font-medium text-faint">
              {monthShort}
            </p>
            {/* Hover érték — natív title helyett jól látható */}
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max max-w-[160px] -translate-x-1/2 border-[1.5px] border-line-strong bg-surface px-2 py-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.12)] group-hover:block"
              role="tooltip"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                {t.label}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
                {t.spentFormatted}
              </p>
              <p className="text-[11px] text-faint">
                {t.orderCount} rendelés
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MixBar({
  leftLabel,
  leftPct,
  rightLabel,
  rightPct,
}: {
  leftLabel: string;
  leftPct: number | null;
  rightLabel: string;
  rightPct: number | null;
}) {
  const l = leftPct ?? 0;
  const r = rightPct ?? 0;
  const sum = l + r;
  const lw = sum > 0 ? Math.round((l / sum) * 100) : 50;
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden border border-line-strong">
        <div className="bg-text" style={{ width: `${lw}%` }} />
        <div className="bg-surface-2" style={{ width: `${100 - lw}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[11px]">
        <span className="font-medium text-text">
          {leftLabel} {leftPct != null ? `${leftPct}%` : "—"}
        </span>
        <span className="font-medium text-faint">
          {rightLabel} {rightPct != null ? `${rightPct}%` : "—"}
        </span>
      </div>
    </div>
  );
}

function FunnelMix({
  guestPct,
  guestSpent,
  guestMeta,
  newcomerPct,
  newcomerSpent,
  newcomerMeta,
  partnerPct,
  partnerSpent,
  partnerMeta,
  otherPct,
  otherSpent,
}: {
  guestPct: number | null;
  guestSpent: string;
  guestMeta: string;
  newcomerPct: number | null;
  newcomerSpent: string;
  newcomerMeta: string;
  partnerPct: number | null;
  partnerSpent: string;
  partnerMeta: string;
  otherPct: number | null;
  otherSpent: string;
}) {
  const g = guestPct ?? 0;
  const n = newcomerPct ?? 0;
  const p = partnerPct ?? 0;
  const o = otherPct ?? 0;
  const sum = g + n + p + o;
  const w = (x: number) => (sum > 0 ? Math.max(x > 0 ? 2 : 0, Math.round((x / sum) * 100)) : 0);
  let gw = w(g);
  let nw = w(n);
  let pw = w(p);
  let ow = w(o);
  const totalW = gw + nw + pw + ow;
  if (totalW > 100 && pw > 0) pw = Math.max(0, pw - (totalW - 100));

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden border border-line-strong">
        {gw > 0 ? (
          <div
            className="bg-[#9a9a9a]"
            style={{ width: `${gw}%` }}
            title={`Vendég ${guestPct}%`}
          />
        ) : null}
        {nw > 0 ? (
          <div
            className="bg-[#5c5c5c]"
            style={{ width: `${nw}%` }}
            title={`Új ${newcomerPct}%`}
          />
        ) : null}
        {pw > 0 ? (
          <div
            className="bg-text"
            style={{ width: `${pw}%` }}
            title={`Partner ${partnerPct}%`}
          />
        ) : null}
        {ow > 0 ? (
          <div
            className="bg-surface-2"
            style={{ width: `${ow}%` }}
            title={`Egyéb ${otherPct}%`}
          />
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="font-semibold text-text">
            Vendég {pct(guestPct)}
          </p>
          <p className="tabular-nums">{guestSpent}</p>
          <p className="text-faint">{guestMeta}</p>
        </div>
        <div>
          <p className="font-semibold text-text">
            Új / alap {pct(newcomerPct)}
          </p>
          <p className="tabular-nums">{newcomerSpent}</p>
          <p className="text-faint">{newcomerMeta}</p>
        </div>
        <div>
          <p className="font-semibold text-text">
            Partner {pct(partnerPct)}
          </p>
          <p className="tabular-nums">{partnerSpent}</p>
          <p className="text-faint">{partnerMeta}</p>
        </div>
      </div>
      {otherPct != null && otherPct > 0 ? (
        <p className="mt-2 text-[10px] text-faint">
          Egyéb (regisztrált, csoport ismeretlen): {otherSpent} ·{" "}
          {pct(otherPct)}
        </p>
      ) : null}
    </div>
  );
}

export function ReportsView() {
  const [months, setMonths] = useState<ReportMonths>(6);
  const [report, setReport] = useState<ShopReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "db" | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [coverageHint, setCoverageHint] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
      setReport(json.report as ShopReport);
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
            setReport(pj.report);
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
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-text">
            Riport
          </h1>
          <p className="mt-0.5 text-[12px] text-faint">
            Bevétel · ki rendelt · mit · mennyiért
            {source === "db" && syncedAt
              ? ` · DB tükör · frissítve ${new Date(syncedAt).toLocaleString("hu-HU")}`
              : source === "live"
                ? " · élő Shoprenter"
                : ""}
          </p>
          {coverageHint ? (
            <p className="mt-1 text-[11px] text-warn">
              Élő Shoprenter (tükör nem elég friss / mély). {coverageHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => void kickSync()}
            className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold disabled:opacity-40"
            title="Rendelés-tükör frissítése (sql/029 után)"
          >
            {syncing ? "…" : "Tükör frissít"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(months)}
            className="h-8 cursor-pointer border-[1.5px] border-line-strong bg-surface px-3 text-[12px] font-semibold disabled:opacity-40"
          >
            {loading ? "…" : "Frissít"}
          </button>
        </div>
      </div>

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
          <div className="grid grid-cols-1 gap-0 border-[1.5px] border-line-strong sm:grid-cols-3">
            {[
              {
                label: "Bevétel",
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
                    Előző: {report.prev.orderCount} · vevő:{" "}
                    {report.activeBuyers}
                  </span>
                ),
              },
              {
                label: "AOV",
                value: report.totals.aovFormatted,
                sub: (
                  <span className="text-faint">
                    Száll. {report.totals.shippingPercent ?? 0}% · kedv.{" "}
                    {report.totals.discountPercent ?? 0}%
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
                <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-text">
                  {k.value}
                </p>
                <p className="mt-1 text-[11px]">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-semibold text-text">
                Bevétel trend · {report.rangeLabel}
              </p>
              {report.truncated ? (
                <p className="text-[11px] text-warn">
                  Minta: legutóbbi ~{report.sampleOrderCount} rendelés
                </p>
              ) : (
                <p className="text-[11px] text-faint">
                  {report.sampleOrderCount} rendelés a mintában
                </p>
              )}
            </div>
            <div className="mt-3 overflow-visible pt-14">
              <TrendBars trend={report.trend} />
            </div>
          </div>

          <div className="grid gap-0 border-[1.5px] border-line-strong sm:grid-cols-3">
            {[
              {
                label: "Rendelési ritmus",
                value:
                  report.partnerGrowth.medianDaysBetweenOrders != null
                    ? `${report.partnerGrowth.medianDaysBetweenOrders} nap`
                    : "—",
                sub: "Medián a rendelések között",
              },
              {
                label: "SKU / vevő",
                value:
                  report.partnerGrowth.avgSkuPerActivePartner != null
                    ? String(report.partnerGrowth.avgSkuPerActivePartner)
                    : "—",
                sub: "Átlag a mintából",
              },
              {
                label: "Widget @ partner",
                value: pct(report.partnerGrowth.widgetPercentOfPartner),
                sub: report.partnerGrowth.partnerWidgetSpentFormatted,
              },
            ].map((k, i) => (
              <div
                key={k.label}
                className={`bg-surface px-3 py-3 ${i > 0 ? "border-t-[1.5px] border-line-strong sm:border-t-0 sm:border-l-[1.5px]" : ""}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {k.label}
                </p>
                <p className="mt-1 text-[16px] font-semibold tabular-nums text-text">
                  {k.value}
                </p>
                <p className="mt-1 text-[10px] text-faint">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-[1.5px] border-line-strong bg-surface p-4">
              <p className="text-[13px] font-semibold text-text">
                Vendég · Új · Partner
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                Vendég = nincs fiók · Új = alap csoport · Partner = átrakva.
                Átrakás a periódusban: {report.movesInRange}
              </p>
              <div className="mt-3">
                <FunnelMix
                  guestPct={report.mix.guestPercent}
                  guestSpent={report.mix.guestSpentFormatted}
                  guestMeta={`${report.mix.guestOrderCount} rend. · ${report.mix.guestBuyers} vevő`}
                  newcomerPct={report.mix.newcomerPercent}
                  newcomerSpent={report.mix.newcomerSpentFormatted}
                  newcomerMeta={`${report.mix.newcomerOrderCount} rend. · ${report.mix.newcomerBuyers} vevő`}
                  partnerPct={report.mix.partnerPercent}
                  partnerSpent={report.mix.partnerSpentFormatted}
                  partnerMeta={`${report.mix.partnerOrderCount} rend. · ${report.mix.partnerBuyers} vevő`}
                  otherPct={report.mix.otherPercent}
                  otherSpent={report.mix.otherSpentFormatted}
                />
              </div>
            </div>

            <div className="border-[1.5px] border-line-strong bg-surface p-4">
              <p className="text-[13px] font-semibold text-text">
                Widget · Bolt
              </p>
              <p className="mt-0.5 text-[11px] text-faint">
                Widget fact: {report.mix.widgetOrderCount} rendelés
              </p>
              <div className="mt-3">
                <MixBar
                  leftLabel="Widget"
                  leftPct={report.mix.widgetPercent}
                  rightLabel="Bolt"
                  rightPct={report.mix.storePercent}
                />
              </div>
              <div className="mt-2 flex justify-between text-[12px] tabular-nums">
                <span>{report.mix.widgetSpentFormatted}</span>
                <span className="text-faint">
                  {report.mix.storeSpentFormatted}
                </span>
              </div>
            </div>
          </div>

          <div className="border-[1.5px] border-line-strong bg-surface">
            <div className="border-b-[1.5px] border-line-strong px-4 py-2.5">
              <p className="text-[13px] font-semibold text-text">
                Vevőcsoportok
              </p>
              <p className="text-[10px] text-faint">
                Terhelés = kedvezmény + szállítás %
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                    <th className="px-3 py-2 text-left">Csoport</th>
                    <th className="px-2 py-2 text-right">Bevétel</th>
                    <th className="px-2 py-2 text-right">AOV</th>
                    <th className="px-2 py-2 text-right">Vevő</th>
                    <th className="px-2 py-2 text-right">Kedv%</th>
                    <th className="px-2 py-2 text-right">Száll%</th>
                    <th className="px-2 py-2 text-right">Terhelés</th>
                    <th className="px-3 py-2 text-right">Widget%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-faint"
                      >
                        Nincs csoport-adat (ujjlenyomat / rendelés).
                      </td>
                    </tr>
                  ) : (
                    report.groups.map((g) => (
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
                          {pct(g.discountPercent)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {pct(g.shippingPercent)}
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
                    {report.topPartners.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-6 text-center text-faint"
                        >
                          Nincs adat.
                        </td>
                      </tr>
                    ) : (
                      report.topPartners.map((p) => (
                        <tr key={p.key} className="border-b border-line">
                          <td className="px-3 py-2">
                            {p.customerInnerId != null ? (
                              <Link
                                href={`/vevok/${p.customerInnerId}`}
                                className="font-semibold underline"
                              >
                                {p.name}
                              </Link>
                            ) : (
                              <span className="font-semibold">{p.name}</span>
                            )}
                            <span className="mt-0.5 block text-[10px] text-faint">
                              {p.isPartner === true
                                ? "Partner"
                                : p.isPartner === false
                                  ? "Új / alap"
                                  : p.customerInnerId == null
                                    ? "Vendég"
                                    : p.email || ""}
                            </span>
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
                <p className="text-[10px] text-faint">
                  Db és bevétel a mintából
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                      <th className="px-3 py-2 text-left">Termék</th>
                      <th className="px-2 py-2 text-left">SKU</th>
                      <th className="px-2 py-2 text-left">Gyártói</th>
                      <th className="px-2 py-2 text-right">Db</th>
                      <th className="px-2 py-2 text-right">Bevétel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-faint"
                        >
                          Nincs tétel a mintában.
                        </td>
                      </tr>
                    ) : (
                      report.topProducts.map((p) => (
                        <tr key={p.sku} className="border-b border-line">
                          <td className="px-3 py-2 font-medium">
                            {p.name || p.sku}
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px] font-semibold">
                            {p.sku}
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px]">
                            {p.modelNumber || "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums font-semibold">
                            {p.quantity}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
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
