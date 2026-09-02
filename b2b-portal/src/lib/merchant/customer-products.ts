/**
 * Merchant Customer 360 — termék katalógus a rendeléstörténetből.
 */

import {
  formatHuf,
  getCustomerOrderDetail,
  listCustomerOrders,
  resolveProductBySku,
  type CustomerOrderLine,
  type ShoprenterConfig,
} from "@/lib/shoprenter";

export type ProductCatalogRow = {
  sku: string;
  modelNumber?: string;
  name?: string;
  gtin?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
  lastPriceNet?: number;
  lastPriceGross?: number;
  lastPriceNetFormatted?: string;
  lastPriceGrossFormatted?: string;
  totalQty: number;
  orderCount: number;
  lastOrderedAt: string;
  lastOrderedLabel: string;
  daysSince: number;
  suggestedQty?: number;
  flag: "due_soon" | "top" | null;
};

export type LastOrderLineRow = {
  sku: string;
  modelNumber?: string;
  name?: string;
  quantity: number;
  priceNet?: number;
  priceGross?: number;
  priceNetFormatted?: string;
  priceGrossFormatted?: string;
  lineTotalGross?: number;
  lineTotalGrossFormatted?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
};

export type CustomerProductsReport = {
  products: ProductCatalogRow[];
  dueSoon: ProductCatalogRow[];
  lastOrder: {
    id: string;
    dateLabel: string;
    totalFormatted: string;
    lines: LastOrderLineRow[];
  } | null;
  legend: string;
  sampleOrderCount: number;
};

type Agg = {
  sku: string;
  modelNumber?: string;
  name?: string;
  gtin?: string;
  productUrl?: string;
  qtys: number[];
  dates: number[];
  lastNet?: number;
  lastGross?: number;
  lastDate: number;
};

function dayMs(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

function median(nums: number[]): number {
  if (!nums.length) return 1;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function codeKey(line: CustomerOrderLine): string {
  const sku = (line.sku || "").trim().toUpperCase();
  if (sku) return sku;
  return (line.modelNumber || "").trim().toUpperCase();
}

function formatDay(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(t));
  } catch {
    return iso.slice(0, 10);
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  );
  return out;
}

const productsCache = new Map<
  string,
  { at: number; data: CustomerProductsReport }
>();
const TTL = 12 * 60 * 1000;

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** DB-first termék riport shop_order_line_facts-ből (0 SR hot path). */
export function buildCustomerProductsReportFromLineFacts(
  lines: Array<{
    sku: string | null;
    sku_norm: string | null;
    model_number: string | null;
    name: string | null;
    quantity: string | number;
    line_gross: string | number;
    line_net: string | number | null;
    date_created: Date | string;
    sr_order_id: string;
  }>,
): CustomerProductsReport | null {
  if (!lines.length) return null;
  const now = Date.now();
  const byCode = new Map<string, Agg>();
  const orderTimes = new Set<number>();

  for (const row of lines) {
    const sku = (row.sku || row.model_number || "").trim();
    const key = (row.sku_norm || sku).toUpperCase();
    if (!key) continue;
    const t =
      row.date_created instanceof Date
        ? row.date_created.getTime()
        : Date.parse(
            String(row.date_created).includes("T")
              ? String(row.date_created)
              : String(row.date_created).replace(" ", "T"),
          );
    if (Number.isFinite(t)) orderTimes.add(t);
    let agg = byCode.get(key);
    if (!agg) {
      agg = {
        sku: sku || key,
        modelNumber: row.model_number || undefined,
        name: row.name || undefined,
        qtys: [],
        dates: [],
        lastDate: 0,
      };
      byCode.set(key, agg);
    }
    if (!agg.name && row.name) agg.name = row.name;
    if (!agg.modelNumber && row.model_number) {
      agg.modelNumber = row.model_number;
    }
    const qty = Math.max(1, num(row.quantity) || 1);
    agg.qtys.push(qty);
    if (Number.isFinite(t) && t) {
      agg.dates.push(t);
      if (t >= agg.lastDate) {
        agg.lastDate = t;
        const gross = num(row.line_gross);
        const net = num(row.line_net);
        if (gross) agg.lastGross = Math.round(gross / qty);
        if (net) agg.lastNet = Math.round(net / qty);
      }
    }
  }

  const times = [...orderTimes].sort((a, b) => b - a);
  let typicalDays: number | null = null;
  if (times.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(times.length - 1, 8); i++) {
      gaps.push((times[i]! - times[i + 1]!) / dayMs(1));
    }
    typicalDays = Math.max(1, Math.round(median(gaps)));
  }

  const products: ProductCatalogRow[] = [];
  byCode.forEach((agg) => {
    const lastT = agg.lastDate || (agg.dates.length ? Math.max(...agg.dates) : 0);
    const suggested = Math.max(
      1,
      median(agg.qtys.filter((q) => q >= 1).slice(0, 12)),
    );
    const daysSince = lastT
      ? Math.max(0, Math.round((now - lastT) / dayMs(1)))
      : 999;
    const orderCount = agg.qtys.length;
    const due =
      orderCount >= 2 && daysSince >= Math.max(10, (typicalDays || 14) - 2);
    products.push({
      sku: agg.sku,
      modelNumber: agg.modelNumber,
      name: agg.name,
      productUrl: null,
      imageUrl: null,
      lastPriceNet: agg.lastNet,
      lastPriceGross: agg.lastGross,
      lastPriceNetFormatted:
        agg.lastNet != null ? formatHuf(Math.round(agg.lastNet)) : undefined,
      lastPriceGrossFormatted:
        agg.lastGross != null
          ? formatHuf(Math.round(agg.lastGross))
          : undefined,
      totalQty: agg.qtys.reduce((a, b) => a + b, 0),
      orderCount,
      lastOrderedAt: lastT ? new Date(lastT).toISOString() : "",
      lastOrderedLabel: lastT ? formatDay(new Date(lastT).toISOString()) : "—",
      daysSince,
      suggestedQty: suggested,
      flag: due ? "due_soon" : null,
    });
  });

  products.sort(
    (a, b) =>
      (b.flag === "due_soon" ? 1 : 0) - (a.flag === "due_soon" ? 1 : 0) ||
      b.orderCount - a.orderCount ||
      b.totalQty - a.totalQty,
  );
  for (const p of products.slice(0, 5)) {
    if (!p.flag) p.flag = "top";
  }

  const dueSoon = products.filter((p) => p.flag === "due_soon").slice(0, 8);
  const lastOrderId = lines[0]?.sr_order_id;
  const lastLines = lines.filter((l) => l.sr_order_id === lastOrderId).slice(0, 40);
  const lastT = lastLines[0]?.date_created;
  const lastIso =
    lastT instanceof Date
      ? lastT.toISOString()
      : lastT
        ? String(lastT)
        : "";

  return {
    products,
    dueSoon,
    lastOrder: lastOrderId
      ? {
          id: lastOrderId,
          dateLabel: lastIso ? formatDay(lastIso) : "—",
          totalFormatted: formatHuf(
            Math.round(
              lastLines.reduce((s, l) => s + num(l.line_gross), 0),
            ),
          ),
          lines: lastLines.map((l) => {
            const qty = Math.max(1, num(l.quantity) || 1);
            const gross = num(l.line_gross);
            const net = num(l.line_net);
            return {
              sku: (l.sku || l.model_number || "").trim(),
              modelNumber: l.model_number || undefined,
              name: l.name || undefined,
              quantity: qty,
              priceNet: net ? Math.round(net / qty) : undefined,
              priceGross: gross ? Math.round(gross / qty) : undefined,
              priceNetFormatted: net
                ? formatHuf(Math.round(net / qty))
                : undefined,
              priceGrossFormatted: gross
                ? formatHuf(Math.round(gross / qty))
                : undefined,
              lineTotalGross: gross ? Math.round(gross) : undefined,
              lineTotalGrossFormatted: gross
                ? formatHuf(Math.round(gross))
                : undefined,
              productUrl: null,
              imageUrl: null,
            };
          }),
        }
      : null,
    legend:
      "Syncelt rendeléssorból. Tipikus db = medián mennyiség. Élő képhez: Frissítés a Shoprenterből.",
    sampleOrderCount: orderTimes.size,
  };
}

export async function buildCustomerProductsReport(
  config: ShoprenterConfig,
  userId: number | string,
  cacheKey: string,
  opts?: { email?: string | null },
): Promise<CustomerProductsReport> {
  const hit = productsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const { orders } = await listCustomerOrders(config, userId, {
    limit: 30,
    page: 0,
    email: opts?.email,
  });
  const now = Date.now();

  const times = orders
    .map((o) => Date.parse(o.dateCreated))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  let typicalDays: number | null = null;
  if (times.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(times.length - 1, 8); i++) {
      gaps.push((times[i]! - times[i + 1]!) / dayMs(1));
    }
    typicalDays = Math.max(1, Math.round(median(gaps)));
  }

  const sample = orders.slice(0, 10);
  const details = await mapPool(sample, 2, async (o) => {
    try {
      await new Promise((r) => setTimeout(r, 250));
      return await getCustomerOrderDetail(config, o.id, userId);
    } catch {
      return null;
    }
  });

  const byCode = new Map<string, Agg>();
  for (const d of details) {
    if (!d) continue;
    const t = Date.parse(d.dateCreated) || 0;
    for (const line of d.lines) {
      const key = codeKey(line);
      if (!key) continue;
      const sku = (line.sku || line.modelNumber || key).trim();
      let agg = byCode.get(key);
      if (!agg) {
        agg = {
          sku,
          modelNumber: line.modelNumber,
          name: line.name,
          gtin: line.gtin,
          productUrl: line.productUrl,
          qtys: [],
          dates: [],
          lastDate: 0,
        };
        byCode.set(key, agg);
      }
      if (!agg.name && line.name) agg.name = line.name;
      if (!agg.modelNumber && line.modelNumber) agg.modelNumber = line.modelNumber;
      if (!agg.gtin && line.gtin) agg.gtin = line.gtin;
      if (!agg.productUrl && line.productUrl) agg.productUrl = line.productUrl;
      agg.qtys.push(Math.max(1, line.quantity || 1));
      if (t) agg.dates.push(t);
      if (t >= agg.lastDate) {
        agg.lastDate = t;
        if (line.priceNet != null) agg.lastNet = line.priceNet;
        if (line.priceGross != null) agg.lastGross = line.priceGross;
      }
    }
  }

  const products: ProductCatalogRow[] = [];
  byCode.forEach((agg) => {
    const lastT = agg.lastDate || (agg.dates.length ? Math.max(...agg.dates) : 0);
    const suggested = Math.max(1, median(agg.qtys.filter((q) => q >= 1).slice(0, 12)));
    const daysSince = lastT
      ? Math.max(0, Math.round((now - lastT) / dayMs(1)))
      : 999;
    const orderCount = agg.qtys.length;
    const due =
      orderCount >= 2 &&
      daysSince >= Math.max(10, (typicalDays || 14) - 2);
    products.push({
      sku: agg.sku,
      modelNumber: agg.modelNumber,
      name: agg.name,
      gtin: agg.gtin,
      productUrl: agg.productUrl ?? null,
      imageUrl: null,
      lastPriceNet: agg.lastNet,
      lastPriceGross: agg.lastGross,
      lastPriceNetFormatted:
        agg.lastNet != null ? formatHuf(Math.round(agg.lastNet)) : undefined,
      lastPriceGrossFormatted:
        agg.lastGross != null
          ? formatHuf(Math.round(agg.lastGross))
          : undefined,
      totalQty: agg.qtys.reduce((a, b) => a + b, 0),
      orderCount,
      lastOrderedAt: lastT ? new Date(lastT).toISOString() : "",
      lastOrderedLabel: lastT ? formatDay(new Date(lastT).toISOString()) : "—",
      daysSince,
      suggestedQty: suggested,
      flag: due ? "due_soon" : null,
    });
  });

  products.sort(
    (a, b) =>
      (b.flag === "due_soon" ? 1 : 0) - (a.flag === "due_soon" ? 1 : 0) ||
      b.orderCount - a.orderCount ||
      b.totalQty - a.totalQty,
  );

  // Top flag (not due)
  for (const p of products.slice(0, 5)) {
    if (!p.flag) p.flag = "top";
  }

  // Enrich images for first 16 (rate-safe)
  const toEnrich = products.slice(0, 16);
  await mapPool(toEnrich, 2, async (p) => {
    if (!p.sku) return p;
    try {
      await new Promise((r) => setTimeout(r, 200));
      const resolved = await resolveProductBySku(config, p.sku);
      if (resolved.found) {
        if (resolved.imageUrl) p.imageUrl = resolved.imageUrl;
        if (resolved.productUrl) p.productUrl = resolved.productUrl;
        if (!p.name && resolved.name) p.name = resolved.name;
        if (!p.modelNumber && resolved.modelNumber) {
          p.modelNumber = resolved.modelNumber;
        }
      }
    } catch {
      /* ignore */
    }
    return p;
  });

  const dueSoon = products.filter((p) => p.flag === "due_soon").slice(0, 8);

  const lastDetail = details.find(Boolean) || null;
  let lastOrder: CustomerProductsReport["lastOrder"] = null;
  if (lastDetail) {
    const lines: LastOrderLineRow[] = lastDetail.lines.slice(0, 40).map((l) => ({
      sku: l.sku || l.modelNumber || "",
      modelNumber: l.modelNumber,
      name: l.name,
      quantity: l.quantity,
      priceNet: l.priceNet,
      priceGross: l.priceGross,
      priceNetFormatted:
        l.priceNet != null ? formatHuf(Math.round(l.priceNet)) : undefined,
      priceGrossFormatted:
        l.priceGross != null ? formatHuf(Math.round(l.priceGross)) : undefined,
      lineTotalGross: l.lineTotalGross,
      lineTotalGrossFormatted:
        l.lineTotalGross != null
          ? formatHuf(Math.round(l.lineTotalGross))
          : undefined,
      productUrl: l.productUrl ?? null,
      imageUrl: null,
    }));
    // Match images from catalog
    const bySku = new Map(
      products.map((p) => [p.sku.toUpperCase(), p] as const),
    );
    for (const line of lines) {
      const hit = bySku.get(line.sku.toUpperCase());
      if (hit) {
        line.imageUrl = hit.imageUrl;
        if (!line.productUrl) line.productUrl = hit.productUrl;
      }
    }
    lastOrder = {
      id: lastDetail.id,
      dateLabel: lastDetail.dateLabel,
      totalFormatted: lastDetail.totalFormatted,
      lines,
    };
  }

  const data: CustomerProductsReport = {
    products,
    dueSoon,
    lastOrder,
    legend:
      "Bolti rendelésekből. Tipikus db = medián mennyiség. Kép: a névre húzva. Kattints a névre a bolt termékoldalához.",
    sampleOrderCount: sample.length,
  };
  productsCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
