import {
  formatHuf,
  getCustomerOrderDetail,
  listCustomerOrders,
  type CustomerOrderLine,
  type ShoprenterConfig,
} from "@/lib/shoprenter";

export type InsightProduct = {
  sku: string;
  modelNumber?: string;
  name?: string;
  orderCount: number;
  totalQty: number;
  avgQty: number;
  lastQty: number;
  suggestedQty: number;
  boostQty: number;
  lastOrderedAt: string;
  daysSince: number;
};

export type PurchaseInsights = {
  stats: {
    orderCount30d: number;
    orderCountLoaded: number;
    totalSpent30d: number;
    totalSpent30dFormatted: string;
    avgOrderValue: number;
    avgOrderValueFormatted: string;
    typicalDaysBetweenOrders: number | null;
    daysSinceLastOrder: number | null;
    nextOrderHint: string | null;
  };
  topProducts: InsightProduct[];
  dueSoon: InsightProduct[];
  lastOrder: {
    id: string;
    dateLabel: string;
    totalFormatted: string;
    lines: { sku: string; quantity: number; name?: string }[];
  } | null;
  incentives: {
    freeShippingGross: number;
    freeShippingLabel: string;
    minOrderGross: number;
    minOrderLabel: string;
  };
};

const FREE_SHIP_GROSS = 80_000;
const MIN_ORDER_GROSS = 25_000;

type Agg = {
  sku: string;
  modelNumber?: string;
  name?: string;
  qtys: number[];
  dates: number[];
};

const insightsCache = new Map<
  string,
  { at: number; data: PurchaseInsights }
>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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
  const model = (line.modelNumber || "").trim().toUpperCase();
  return model;
}

function suggestFromQtys(qtys: number[]): { suggested: number; boost: number } {
  const clean = qtys.filter((q) => q >= 1).slice(0, 12);
  if (!clean.length) return { suggested: 1, boost: 2 };
  const suggested = Math.max(1, median(clean));
  const boost = Math.max(suggested + 1, Math.round(suggested * 1.25));
  return { suggested, boost };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]!, idx);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

export async function getCustomerPurchaseInsights(
  config: ShoprenterConfig,
  userId: number | string,
): Promise<PurchaseInsights> {
  const cacheKey = String(userId);
  const hit = insightsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const { orders } = await listCustomerOrders(config, userId, {
    limit: 25,
    page: 0,
  });

  const now = Date.now();
  const monthAgo = now - dayMs(30);
  const orders30 = orders.filter((o) => {
    const t = Date.parse(o.dateCreated);
    return Number.isFinite(t) && t >= monthAgo;
  });
  const spent30 = orders30.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder =
    orders30.length > 0
      ? Math.round(spent30 / orders30.length)
      : orders.length
        ? Math.round(
            orders.reduce((s, o) => s + (o.total || 0), 0) / orders.length,
          )
        : 0;

  const orderTimes = orders
    .map((o) => Date.parse(o.dateCreated))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  let typicalDays: number | null = null;
  if (orderTimes.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(orderTimes.length - 1, 8); i++) {
      gaps.push((orderTimes[i]! - orderTimes[i + 1]!) / dayMs(1));
    }
    typicalDays = Math.max(1, Math.round(median(gaps)));
  }
  const daysSinceLast =
    orderTimes.length > 0
      ? Math.max(0, Math.round((now - orderTimes[0]!) / dayMs(1)))
      : null;

  let nextOrderHint: string | null = null;
  if (daysSinceLast != null && typicalDays != null) {
    if (daysSinceLast >= typicalDays) {
      nextOrderHint = `Általában ~${typicalDays} naponta rendelsz. Most jönne a következő kör.`;
    } else {
      const left = typicalDays - daysSinceLast;
      nextOrderHint = `Szokásos ritmusod ~${typicalDays} nap. Kb. ${left} nap múlva esedékes a következő.`;
    }
  } else if (daysSinceLast != null && daysSinceLast >= 21) {
    nextOrderHint = `Már ${daysSinceLast} napja nem rendeltél. Érdemes átnézni a top tételeket.`;
  }

  const sample = orders.slice(0, 10);
  const details = await mapPool(sample, 2, async (o) => {
    try {
      await new Promise((r) => setTimeout(r, 280));
      return await getCustomerOrderDetail(config, o.id, userId);
    } catch {
      return null;
    }
  });

  const byCode = new Map<string, Agg>();
  details.forEach((d) => {
    if (!d) return;
    const t = Date.parse(d.dateCreated) || 0;
    d.lines.forEach((line) => {
      const key = codeKey(line);
      if (!key) return;
      const sku = (line.sku || line.modelNumber || key).trim();
      let agg = byCode.get(key);
      if (!agg) {
        agg = {
          sku,
          modelNumber: line.modelNumber,
          name: line.name,
          qtys: [],
          dates: [],
        };
        byCode.set(key, agg);
      }
      if (!agg.name && line.name) agg.name = line.name;
      if (!agg.modelNumber && line.modelNumber) agg.modelNumber = line.modelNumber;
      agg.qtys.push(Math.max(1, line.quantity || 1));
      if (t) agg.dates.push(t);
    });
  });

  const products: InsightProduct[] = [];
  byCode.forEach((agg) => {
    const lastT = agg.dates.length ? Math.max(...agg.dates) : 0;
    const { suggested, boost } = suggestFromQtys(agg.qtys);
    products.push({
      sku: agg.sku,
      modelNumber: agg.modelNumber,
      name: agg.name,
      orderCount: agg.qtys.length,
      totalQty: agg.qtys.reduce((a, b) => a + b, 0),
      avgQty: Math.max(1, Math.round(agg.qtys.reduce((a, b) => a + b, 0) / agg.qtys.length)),
      lastQty: agg.qtys[0] || suggested,
      suggestedQty: suggested,
      boostQty: boost,
      lastOrderedAt: lastT ? new Date(lastT).toISOString() : "",
      daysSince: lastT ? Math.max(0, Math.round((now - lastT) / dayMs(1))) : 999,
    });
  });

  products.forEach((p) => {
    const key = p.sku.toUpperCase();
    const modelKey = (p.modelNumber || "").toUpperCase();
    const agg =
      byCode.get(key) ||
      (modelKey ? byCode.get(modelKey) : undefined);
    if (!agg || !agg.dates.length) return;
    let bestQty = p.lastQty;
    let bestT = -1;
    for (let i = 0; i < agg.dates.length; i++) {
      const t = agg.dates[i] || 0;
      if (t >= bestT) {
        bestT = t;
        bestQty = agg.qtys[i] || bestQty;
      }
    }
    p.lastQty = bestQty;
  });

  const topProducts = [...products]
    .sort((a, b) => b.orderCount - a.orderCount || b.totalQty - a.totalQty)
    .slice(0, 8);

  const dueSoon = [...products]
    .filter((p) => p.orderCount >= 2 && p.daysSince >= Math.max(10, (typicalDays || 14) - 2))
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 6);

  const lastDetail = details.find(Boolean) || null;
  const lastOrder = lastDetail
    ? {
        id: lastDetail.id,
        dateLabel: lastDetail.dateLabel,
        totalFormatted: lastDetail.totalFormatted,
        lines: lastDetail.lines.slice(0, 40).map((l) => ({
          sku: l.sku || l.modelNumber || "",
          quantity: l.quantity,
          name: l.name,
        })),
      }
    : null;

  const data: PurchaseInsights = {
    stats: {
      orderCount30d: orders30.length,
      orderCountLoaded: orders.length,
      totalSpent30d: Math.round(spent30),
      totalSpent30dFormatted: formatHuf(Math.round(spent30)),
      avgOrderValue: avgOrder,
      avgOrderValueFormatted: formatHuf(avgOrder),
      typicalDaysBetweenOrders: typicalDays,
      daysSinceLastOrder: daysSinceLast,
      nextOrderHint,
    },
    topProducts,
    dueSoon,
    lastOrder,
    incentives: {
      freeShippingGross: FREE_SHIP_GROSS,
      freeShippingLabel: formatHuf(FREE_SHIP_GROSS),
      minOrderGross: MIN_ORDER_GROSS,
      minOrderLabel: formatHuf(MIN_ORDER_GROSS),
    },
  };

  insightsCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
