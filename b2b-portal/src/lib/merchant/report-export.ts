import * as XLSX from "xlsx";
import type { ShopReport } from "@/lib/merchant/shop-report";

function pct(n: number | null | undefined): string {
  return n == null ? "" : `${n}%`;
}

/** Client-side Excel: Összesítő + Partnerek + Termékek + Csoportok. */
export function downloadShopReportXlsx(report: ShopReport, filename?: string) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["ProGate Riport", report.rangeLabel],
    [],
    ["Bevétel", report.totals.spentFormatted, "Δ%", pct(report.totals.deltaPercent)],
    ["Rendelés", report.totals.orderCount, "Előző", report.prev.orderCount],
    ["AOV", report.totals.aovFormatted],
    ["Partner bevétel", report.partnerTotals.spentFormatted],
    ["Partner AOV", report.partnerTotals.aovFormatted],
    ["Aktív partnerek", report.partnerTotals.buyers],
    ["NRR %", pct(report.partnerGrowth.nrrPercent)],
    ["Alvó partnerek", report.partnerGrowth.sleepingCount],
    ["Widget %", pct(report.mix.widgetPercent)],
    ["Widget @ partner %", pct(report.partnerGrowth.widgetPercentOfPartner)],
    ["Árrés %", pct(report.profit.marginPercent)],
    ["Cost lefedettség %", pct(report.profit.coveragePercent)],
    ["Bruttó profit", report.profit.grossProfitFormatted],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summary),
    "Osszesito",
  );

  const partners = [
    ["Név", "Email", "Partner", "Rendelés", "Bevétel", "Δ%", "Csoport ID"],
    ...report.topPartners.map((p) => [
      p.name,
      p.email || "",
      p.isPartner === true ? "igen" : p.isPartner === false ? "nem" : "",
      p.orderCount,
      p.spent,
      pct(p.deltaPercent),
      p.groupInnerId ?? "",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(partners),
    "Partnerek",
  );

  const products = [
    ["SKU", "Cikkszám", "Név", "Db", "Bevétel", "Árrés %", "Van cost"],
    ...report.topProducts.map((p) => [
      p.sku,
      p.modelNumber || "",
      p.name || "",
      p.quantity,
      p.lineRevenue,
      pct(p.marginPercent),
      p.hasCost ? "igen" : "nem",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(products),
    "Termekek",
  );

  const groups = [
    [
      "Csoport",
      "Bevétel",
      "Rendelés",
      "AOV",
      "Vevő",
      "Kedv%",
      "Száll%",
      "Terhelés%",
      "Widget%",
      "NRR%",
    ],
    ...report.groups.map((g) => [
      g.name,
      g.spent,
      g.orderCount,
      g.aovFormatted,
      g.buyers,
      pct(g.discountPercent),
      pct(g.shippingPercent),
      pct(g.loadPercent),
      pct(g.widgetPercent),
      pct(g.nrrPercent),
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(groups),
    "Csoportok",
  );

  const watch = [
    ["Típus", "Név", "Email", "Rendelés", "Bevétel", "Δ%"],
    ...report.watchlist.declining.map((p) => [
      "Zuhanó",
      p.name,
      p.email || "",
      p.orderCount,
      p.spent,
      pct(p.deltaPercent),
    ]),
    ...report.watchlist.sleeping.map((p) => [
      "Alvó",
      p.name,
      p.email || "",
      "",
      "",
      "",
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(watch), "Figyelendo");

  const name =
    filename ||
    `progate-riport-${report.rangeMonths}ho-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
