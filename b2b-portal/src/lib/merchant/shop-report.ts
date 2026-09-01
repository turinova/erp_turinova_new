/**
 * Bolt-szintű Riport — bevétel, partner növekedés, csoportok, költség/profit proxy.
 * Shoprenter `cost` gyakran üres → lefedettséggel jelezzük.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import {
  formatHuf,
  getOrderDetailById,
  listShopOrders,
  parseShoprenterOrderTime,
  type CustomerOrderSummary,
  type ShoprenterConfig,
} from "@/lib/shoprenter";
import { listCustomerGroups } from "@/lib/shoprenter/customers";
import { listGroupMap } from "@/lib/merchant/customer-group-map";

export type ReportMonths = 3 | 6 | 12 | 24;

export type ShopReport = {
  rangeMonths: ReportMonths;
  rangeLabel: string;
  sampleOrderCount: number;
  truncated: boolean;
  totals: {
    spent: number;
    spentFormatted: string;
    orderCount: number;
    aov: number;
    aovFormatted: string;
    deltaPercent: number | null;
    shipping: number;
    shippingFormatted: string;
    discount: number;
    discountFormatted: string;
    shippingPercent: number | null;
    discountPercent: number | null;
  };
  prev: {
    spent: number;
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
    /** Termék nettó árbevétel (ahol van cost) — szállítás/utánvét NÉLKÜL */
    revenueWithCost: number;
    revenueWithCostFormatted: string;
    costTotal: number;
    costTotalFormatted: string;
    grossProfit: number;
    grossProfitFormatted: string;
    marginPercent: number | null;
    /** Hány % a termék-tétel nettóból van költséggel */
    coveragePercent: number | null;
    skuWithCost: number;
    skuTotal: number;
    /** Explicit: árrés soha nem tartalmaz szállítást / utánvétet */
    excludesShippingAndFees: true;
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
    /** Vendég = nincs SR fiók (customerInnerId) */
    guestSpent: number;
    guestSpentFormatted: string;
    guestPercent: number | null;
    guestOrderCount: number;
    guestBuyers: number;
    /** Regisztrált, alap csoport */
    newcomerSpent: number;
    newcomerSpentFormatted: string;
    newcomerPercent: number | null;
    newcomerOrderCount: number;
    newcomerBuyers: number;
    /** Regisztrált, nem alap csoport */
    partnerSpent: number;
    partnerSpentFormatted: string;
    partnerPercent: number | null;
    partnerOrderCount: number;
    partnerBuyers: number;
    /** Regisztrált, de csoport nem ismert */
    otherSpent: number;
    otherSpentFormatted: string;
    otherPercent: number | null;
    widgetSpent: number;
    widgetSpentFormatted: string;
    widgetOrderCount: number;
    widgetPercent: number | null;
    storeSpent: number;
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
    spent: number;
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
    spent: number;
    spentFormatted: string;
    deltaPercent: number | null;
  }[];
  topProducts: {
    sku: string;
    modelNumber: string | null;
    name: string | null;
    quantity: number;
    lineRevenue: number;
    lineRevenueFormatted: string;
    costTotal: number | null;
    costTotalFormatted: string | null;
    marginPercent: number | null;
    hasCost: boolean;
  }[];
};

type PartnerAgg = {
  key: string;
  name: string;
  email: string | null;
  customerInnerId: number | null;
  groupInnerId: number | null;
  isPartner: boolean | null;
  orderCount: number;
  spent: number;
  shipping: number;
  discount: number;
  times: number[];
  skus: Set<string>;
};

type GroupAgg = {
  groupInnerId: number;
  spent: number;
  prevSpent: number;
  orderCount: number;
  shipping: number;
  discount: number;
  buyers: Set<string>;
  widgetSpent: number;
};

const reportCache = new Map<string, { at: number; data: ShopReport }>();
const TTL = 10 * 60 * 1000;

export type ReportPhase = "summary" | "products" | "full";

type SummaryScratch = {
  at: number;
  months: ReportMonths;
  inRange: CustomerOrderSummary[];
  report: ShopReport;
  partners: Map<string, PartnerAgg>;
};

const summaryScratch = new Map<string, SummaryScratch>();

const DETAIL_CONCURRENCY = 3;
const PRODUCT_SAMPLE = 14;

/**
 * Live path only fetches line details for a small sample.
 * Prefer partner (and then logged-in) orders so SKU / vevő isn't empty
 * when the newest N rows are almost all guests.
 */
function sampleOrdersForProducts(
  inRange: CustomerOrderSummary[],
  partners: Map<string, PartnerAgg>,
  limit: number,
): CustomerOrderSummary[] {
  if (inRange.length <= limit) return inRange;
  const partnerOrders: CustomerOrderSummary[] = [];
  const loggedOrders: CustomerOrderSummary[] = [];
  const guestOrders: CustomerOrderSummary[] = [];
  for (const o of inRange) {
    const key = buyerKey(o);
    const p = partners.get(key);
    if (p?.isPartner === true) partnerOrders.push(o);
    else if (o.customerInnerId != null) loggedOrders.push(o);
    else guestOrders.push(o);
  }
  const out: CustomerOrderSummary[] = [];
  const seen = new Set<string>();
  for (const o of [...partnerOrders, ...loggedOrders, ...guestOrders]) {
    if (out.length >= limit) break;
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

function dayMs(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

/** Shoprenter: "2024-03-15 12:30:00" — Date.parse gyakran NaN. */
function parseOrderTime(raw: string | null | undefined): number {
  return parseShoprenterOrderTime(raw);
}

function monthKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return key;
  }
}

function buildMonthKeys(fromMs: number, toMs: number): string[] {
  const keys: string[] = [];
  const d = new Date(fromMs);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const end = new Date(toMs);
  end.setDate(1);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    keys.push(monthKey(d.getTime()));
    d.setMonth(d.getMonth() + 1);
  }
  return keys;
}

function spentOf(o: CustomerOrderSummary): number {
  return Math.round(o.totalGross ?? o.total ?? 0);
}

/** Szállítás / utánvét / díjsor — soha nem megy az árrésbe. */
function isFeeOrShippingLine(line: {
  sku?: string;
  name?: string;
  modelNumber?: string;
}): boolean {
  const hay = `${line.name || ""} ${line.sku || ""} ${line.modelNumber || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return /szallit|shipping|freight|utanvet|utanveteli|utanveti|\bcod\b|payment\s*fee|kezelesi\s*dij|kezelesi/.test(
    hay,
  );
}

function productLineNet(line: {
  quantity: number;
  lineTotalNet?: number;
  priceNet?: number;
}): number | null {
  if (line.lineTotalNet != null && Number.isFinite(line.lineTotalNet)) {
    return Math.round(line.lineTotalNet);
  }
  if (line.priceNet != null && Number.isFinite(line.priceNet)) {
    return Math.round(line.priceNet * Math.max(1, line.quantity || 1));
  }
  return null;
}

function productLineGross(line: {
  quantity: number;
  lineTotalGross?: number;
  priceGross?: number;
}): number {
  if (line.lineTotalGross != null && Number.isFinite(line.lineTotalGross)) {
    return Math.round(line.lineTotalGross);
  }
  if (line.priceGross != null && Number.isFinite(line.priceGross)) {
    return Math.round(line.priceGross * Math.max(1, line.quantity || 1));
  }
  return 0;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
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

function buyerKey(o: CustomerOrderSummary): string {
  if (o.customerInnerId != null) return `id:${o.customerInnerId}`;
  if (o.email) return `em:${o.email}`;
  return `ord:${o.id}`;
}

export async function buildShopReport(
  config: ShoprenterConfig,
  client: PoolClient,
  shopId: string,
  cacheKey: string,
  months: ReportMonths,
  phase: ReportPhase = "full",
): Promise<ShopReport> {
  let activePhase: ReportPhase = phase;
  const fullKey = `${cacheKey}:full`;
  const summaryKey = `${cacheKey}:summary`;

  if (activePhase === "full" || activePhase === "summary") {
    const hit = reportCache.get(activePhase === "full" ? fullKey : summaryKey);
    if (hit && Date.now() - hit.at < TTL) {
      return hit.data;
    }
  }

  if (activePhase === "products") {
    const fullHit = reportCache.get(fullKey);
    if (fullHit && Date.now() - fullHit.at < TTL) return fullHit.data;
    const scratch = summaryScratch.get(summaryKey);
    if (scratch && Date.now() - scratch.at < TTL) {
      const enriched = await enrichReportProducts(
        config,
        client,
        shopId,
        scratch,
      );
      reportCache.set(fullKey, { at: Date.now(), data: enriched });
      reportCache.set(summaryKey, { at: Date.now(), data: enriched });
      return enriched;
    }
    activePhase = "full";
  }

  const now = Date.now();
  const rangeMs = dayMs(months * 30);
  const rangeStart = now - rangeMs;
  const prevStart = rangeStart - rangeMs;

  const maxPages =
    months <= 3 ? 12 : months <= 6 ? 16 : months <= 12 ? 20 : 24;
  const all = await listShopOrders(config, {
    dateFromMs: prevStart,
    dateToMs: now,
    maxPages,
    limit: 50,
  });

  const inRange = all.filter((o) => {
    const t = parseOrderTime(o.dateCreated);
    return t >= rangeStart && t <= now;
  });
  const prevRange = all.filter((o) => {
    const t = parseOrderTime(o.dateCreated);
    return t >= prevStart && t < rangeStart;
  });

  let spent = 0;
  let shipping = 0;
  let discount = 0;
  for (const o of inRange) {
    spent += spentOf(o);
    shipping += Math.round(o.shippingGross ?? o.shippingNet ?? 0);
    discount += Math.round(o.discountGross ?? 0);
  }
  let prevSpent = 0;
  for (const o of prevRange) prevSpent += spentOf(o);

  const orderCount = inRange.length;
  const aov = orderCount > 0 ? Math.round(spent / orderCount) : 0;
  const deltaPercent =
    prevSpent > 0
      ? Math.round(((spent - prevSpent) / prevSpent) * 100)
      : spent > 0
        ? 100
        : null;

  const byMonth = new Map<string, { spent: number; orderCount: number }>();
  for (const key of buildMonthKeys(rangeStart, now)) {
    byMonth.set(key, { spent: 0, orderCount: 0 });
  }
  for (const o of inRange) {
    const t = parseOrderTime(o.dateCreated);
    if (!t) continue;
    const key = monthKey(t);
    const cur = byMonth.get(key) || { spent: 0, orderCount: 0 };
    cur.spent += spentOf(o);
    cur.orderCount += 1;
    byMonth.set(key, cur);
  }
  const trend = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      key,
      label: monthLabel(key),
      spent: v.spent,
      spentFormatted: formatHuf(v.spent),
      orderCount: v.orderCount,
    }));

  let defaultGroupId: number | null = null;
  const groupNameById = new Map<number, string>();
  const roleByGroup = new Map<number, string>();
  const partnerByInner = new Map<number, boolean>();
  const groupByInner = new Map<number, number | null>();
  const partnerFingerprintIds = new Set<number>();
  const widgetByInner = new Map<number, number>();

  const [groupsResult, mapResult, fpResult, widgetResult] = await Promise.all([
    listCustomerGroups(config).catch(() => [] as Awaited<ReturnType<typeof listCustomerGroups>>),
    listGroupMap(client, shopId).catch(() => [] as Awaited<ReturnType<typeof listGroupMap>>),
    query<{
      sr_customer_inner_id: number;
      sr_group_inner_id: number | null;
    }>(
      client,
      `select sr_customer_inner_id, sr_group_inner_id
       from shop_customers
       where shop_id = $1 and sr_status = 'active'`,
      [shopId],
    ).catch(() => ({ rows: [] as { sr_customer_inner_id: number; sr_group_inner_id: number | null }[] })),
    query<{
      sr_customer_inner_id: number | null;
      sum: string | null;
    }>(
      client,
      `select sr_customer_inner_id, coalesce(sum(gross_total), 0)::text as sum
       from b2b_orders
       where shop_id = $1
         and status <> 'cancelled'
         and created_at >= to_timestamp($2 / 1000.0)
         and created_at <= to_timestamp($3 / 1000.0)
       group by sr_customer_inner_id`,
      [shopId, rangeStart, now],
    ).catch(() => ({ rows: [] as { sr_customer_inner_id: number | null; sum: string | null }[] })),
  ]);

  for (const g of groupsResult) {
    groupNameById.set(g.innerId, g.name);
    if (g.isDefault) defaultGroupId = g.innerId;
  }
  for (const row of mapResult) {
    roleByGroup.set(row.sr_group_inner_id, row.role);
    if (row.sr_name_snapshot) {
      groupNameById.set(row.sr_group_inner_id, row.sr_name_snapshot);
    }
  }
  for (const row of fpResult.rows) {
    groupByInner.set(row.sr_customer_inner_id, row.sr_group_inner_id);
    if (defaultGroupId == null) continue;
    const isPartner =
      row.sr_group_inner_id != null &&
      row.sr_group_inner_id !== defaultGroupId;
    partnerByInner.set(row.sr_customer_inner_id, isPartner);
    if (isPartner) partnerFingerprintIds.add(row.sr_customer_inner_id);
  }
  for (const row of widgetResult.rows) {
    if (row.sr_customer_inner_id == null) continue;
    widgetByInner.set(
      row.sr_customer_inner_id,
      Math.round(Number(row.sum || 0)),
    );
  }

  let partnerSpent = 0;
  let newcomerSpent = 0;
  let guestSpent = 0;
  let otherSpent = 0;
  let partnerOrderCount = 0;
  let newcomerOrderCount = 0;
  let guestOrderCount = 0;
  let partnerWidgetSpent = 0;
  const partners = new Map<string, PartnerAgg>();
  const prevPartnerSpend = new Map<string, number>();
  const groupsAgg = new Map<number, GroupAgg>();
  const buyerKeys = new Set<string>();
  const activePartnerIds = new Set<number>();
  const guestBuyers = new Set<string>();
  const newcomerBuyers = new Set<string>();
  const partnerBuyers = new Set<string>();

  function ensureGroup(gid: number): GroupAgg {
    let g = groupsAgg.get(gid);
    if (!g) {
      g = {
        groupInnerId: gid,
        spent: 0,
        prevSpent: 0,
        orderCount: 0,
        shipping: 0,
        discount: 0,
        buyers: new Set(),
        widgetSpent: 0,
      };
      groupsAgg.set(gid, g);
    }
    return g;
  }

  for (const o of prevRange) {
    const key = buyerKey(o);
    const s = spentOf(o);
    prevPartnerSpend.set(key, (prevPartnerSpend.get(key) || 0) + s);
    const gid =
      o.customerInnerId != null
        ? groupByInner.get(o.customerInnerId) ?? null
        : null;
    if (gid != null) {
      const g = ensureGroup(gid);
      g.prevSpent += s;
    }
  }

  for (const o of inRange) {
    const s = spentOf(o);
    const ship = Math.round(o.shippingGross ?? o.shippingNet ?? 0);
    const disc = Math.round(o.discountGross ?? 0);
    const key = buyerKey(o);
    buyerKeys.add(key);

    let isPartner: boolean | null = null;
    let groupInnerId: number | null = null;
    let segment: "guest" | "newcomer" | "partner" | "other";

    if (o.customerInnerId == null) {
      // Vendég checkout — nincs SR fiók / csoport
      segment = "guest";
    } else {
      groupInnerId = groupByInner.get(o.customerInnerId) ?? null;
      if (partnerByInner.has(o.customerInnerId)) {
        isPartner = partnerByInner.get(o.customerInnerId)!;
      } else if (defaultGroupId != null && groupInnerId != null) {
        isPartner = groupInnerId !== defaultGroupId;
      } else if (
        defaultGroupId != null &&
        groupInnerId === defaultGroupId
      ) {
        isPartner = false;
      } else if (groupInnerId != null) {
        const role = roleByGroup.get(groupInnerId);
        if (role === "rejtett") isPartner = false;
        else if (role === "bolt" || role === "gomb") isPartner = true;
        else isPartner = true;
      }

      if (isPartner === true) {
        segment = "partner";
        activePartnerIds.add(o.customerInnerId);
      } else if (isPartner === false) {
        segment = "newcomer";
      } else {
        segment = "other";
      }
    }

    if (segment === "guest") {
      guestSpent += s;
      guestOrderCount += 1;
      guestBuyers.add(key);
    } else if (segment === "newcomer") {
      newcomerSpent += s;
      newcomerOrderCount += 1;
      newcomerBuyers.add(key);
    } else if (segment === "partner") {
      partnerSpent += s;
      partnerOrderCount += 1;
      partnerBuyers.add(key);
    } else {
      otherSpent += s;
    }

    if (groupInnerId != null) {
      const g = ensureGroup(groupInnerId);
      g.spent += s;
      g.orderCount += 1;
      g.shipping += ship;
      g.discount += disc;
      g.buyers.add(key);
    }

    const agg = partners.get(key) || {
      key,
      name: o.customerName || o.email || `Rendelés #${o.innerId}`,
      email: o.email ?? null,
      customerInnerId: o.customerInnerId ?? null,
      groupInnerId,
      isPartner,
      orderCount: 0,
      spent: 0,
      shipping: 0,
      discount: 0,
      times: [],
      skus: new Set<string>(),
    };
    if (o.customerName && (!agg.name || agg.name.startsWith("Rendelés"))) {
      agg.name = o.customerName;
    }
    if (o.email && !agg.email) agg.email = o.email;
    if (o.customerInnerId != null) agg.customerInnerId = o.customerInnerId;
    if (groupInnerId != null) agg.groupInnerId = groupInnerId;
    if (isPartner != null) agg.isPartner = isPartner;
    agg.orderCount += 1;
    agg.spent += s;
    agg.shipping += ship;
    agg.discount += disc;
    const t = parseOrderTime(o.dateCreated);
    if (t) agg.times.push(t);
    partners.set(key, agg);
  }

  // Widget összeg partnerenként / csoportonként egyszer
  const countedWidgetPartner = new Set<number>();
  const countedWidgetGroup = new Set<string>();
  for (const p of partners.values()) {
    if (p.customerInnerId == null) continue;
    const w = widgetByInner.get(p.customerInnerId) || 0;
    if (w <= 0) continue;
    if (p.isPartner === true && !countedWidgetPartner.has(p.customerInnerId)) {
      partnerWidgetSpent += w;
      countedWidgetPartner.add(p.customerInnerId);
    }
    if (p.groupInnerId != null) {
      const gk = `${p.groupInnerId}:${p.customerInnerId}`;
      if (!countedWidgetGroup.has(gk)) {
        ensureGroup(p.groupInnerId).widgetSpent += w;
        countedWidgetGroup.add(gk);
      }
    }
  }

  const segmentTotal =
    partnerSpent + newcomerSpent + guestSpent + otherSpent;
  const pctOf = (n: number) =>
    segmentTotal > 0 ? Math.round((n / segmentTotal) * 100) : null;
  const partnerPercent = pctOf(partnerSpent);
  const newcomerPercent = pctOf(newcomerSpent);
  const guestPercent = pctOf(guestSpent);
  const otherPercent = pctOf(otherSpent);

  let widgetSpent = 0;
  let widgetOrderCount = 0;
  for (const v of widgetByInner.values()) widgetSpent += v;
  let movesInRange = 0;
  const [wrCnt, mrCnt] = await Promise.all([
    query<{ cnt: string }>(
      client,
      `select count(*)::text as cnt
       from b2b_orders
       where shop_id = $1
         and status <> 'cancelled'
         and created_at >= to_timestamp($2 / 1000.0)
         and created_at <= to_timestamp($3 / 1000.0)`,
      [shopId, rangeStart, now],
    ).catch(() => ({ rows: [{ cnt: "0" }] })),
    query<{ cnt: string }>(
      client,
      `select count(*)::text as cnt
       from shop_customer_group_moves
       where shop_id = $1
         and created_at >= to_timestamp($2 / 1000.0)
         and created_at <= to_timestamp($3 / 1000.0)`,
      [shopId, rangeStart, now],
    ).catch(() => ({ rows: [{ cnt: "0" }] })),
  ]);
  widgetOrderCount = Number(wrCnt.rows[0]?.cnt || 0);
  movesInRange = Number(mrCnt.rows[0]?.cnt || 0);

  const storeSpent = Math.max(0, spent - widgetSpent);
  const widgetPercent =
    spent > 0 ? Math.round((Math.min(widgetSpent, spent) / spent) * 100) : null;
  const storePercent =
    spent > 0 ? Math.round((storeSpent / spent) * 100) : null;

  // Partner NRR: előző periódusban költő partnerek mostani / akkori költése
  let nrrBase = 0;
  let nrrNow = 0;
  for (const [key, prevS] of prevPartnerSpend) {
    const agg = partners.get(key);
    const wasPartner =
      agg?.isPartner === true ||
      (agg?.customerInnerId != null &&
        partnerByInner.get(agg.customerInnerId) === true);
    // ha nincs mostani agg, nézzük fingerprint / prev order customer
    if (!wasPartner && !agg) {
      // prev-only: try parse id from key
      const m = /^id:(\d+)$/.exec(key);
      if (m && partnerByInner.get(Number(m[1])) === true) {
        nrrBase += prevS;
        // nrrNow += 0 (silent churn)
      }
      continue;
    }
    if (agg?.isPartner !== true && wasPartner !== true) continue;
    nrrBase += prevS;
    nrrNow += agg?.spent || 0;
  }
  const nrrPercent =
    nrrBase > 0 ? Math.round((nrrNow / nrrBase) * 100) : null;

  const sleepingCount = Math.max(
    0,
    partnerFingerprintIds.size - activePartnerIds.size,
  );

  const partnerGaps: number[] = [];
  for (const p of partners.values()) {
    if (p.isPartner !== true || p.times.length < 2) continue;
    const sorted = [...p.times].sort((a, b) => b - a);
    for (let i = 0; i < Math.min(sorted.length - 1, 6); i++) {
      partnerGaps.push((sorted[i]! - sorted[i + 1]!) / dayMs(1));
    }
  }
  const medianDaysBetweenOrders = median(
    partnerGaps.map((d) => Math.max(1, Math.round(d))),
  );

  const sampleForProducts = sampleOrdersForProducts(
    inRange,
    partners,
    PRODUCT_SAMPLE,
  );
  let topProducts: ShopReport["topProducts"] = [];
  let avgSkuPerActivePartner: number | null = null;
  let revenueWithCost = 0;
  let costTotal = 0;
  let grossProfit = 0;
  let marginPercent: number | null = null;
  let coveragePercent: number | null = null;
  let skuWithCost = 0;
  let skuListLen = 0;
  let profitNote = "Termék / árrés betöltése…";

  const needProducts = activePhase !== "summary";
  if (needProducts) {
    const productBlock = await computeProductBlock(
      config,
      client,
      shopId,
      sampleForProducts,
      partners,
    );
    topProducts = productBlock.topProducts;
    avgSkuPerActivePartner = productBlock.avgSkuPerActivePartner;
    revenueWithCost = productBlock.revenueWithCost;
    costTotal = productBlock.costTotal;
    grossProfit = productBlock.grossProfit;
    marginPercent = productBlock.marginPercent;
    coveragePercent = productBlock.coveragePercent;
    skuWithCost = productBlock.skuWithCost;
    skuListLen = productBlock.skuListLen;
    profitNote = productBlock.note;
  }

  const widgetPercentOfPartner =
    partnerSpent > 0
      ? Math.round((Math.min(partnerWidgetSpent, partnerSpent) / partnerSpent) * 100)
      : null;

  const topPartners = [...partners.values()]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10)
    .map((p) => {
      const prev = prevPartnerSpend.get(p.key) || 0;
      const dlt =
        prev > 0
          ? Math.round(((p.spent - prev) / prev) * 100)
          : p.spent > 0
            ? 100
            : null;
      return {
        key: p.key,
        name: p.name,
        email: p.email,
        customerInnerId: p.customerInnerId,
        isPartner: p.isPartner,
        orderCount: p.orderCount,
        spent: p.spent,
        spentFormatted: formatHuf(p.spent),
        deltaPercent: dlt,
      };
    });

  const groups = [...groupsAgg.values()]
    .filter((g) => g.spent > 0 || g.prevSpent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((g) => {
      const aovG =
        g.orderCount > 0 ? Math.round(g.spent / g.orderCount) : 0;
      const discPct =
        g.spent > 0 ? Math.round((g.discount / g.spent) * 100) : null;
      const shipPct =
        g.spent > 0 ? Math.round((g.shipping / g.spent) * 100) : null;
      const loadPct =
        g.spent > 0
          ? Math.round(((g.discount + g.shipping) / g.spent) * 100)
          : null;
      const wPct =
        g.spent > 0
          ? Math.round((Math.min(g.widgetSpent, g.spent) / g.spent) * 100)
          : null;
      const gNrr =
        g.prevSpent > 0
          ? Math.round((g.spent / g.prevSpent) * 100)
          : null;
      return {
        groupInnerId: g.groupInnerId,
        name:
          groupNameById.get(g.groupInnerId) || `Csoport #${g.groupInnerId}`,
        role: roleByGroup.get(g.groupInnerId) ?? null,
        isDefault: defaultGroupId === g.groupInnerId,
        spent: g.spent,
        spentFormatted: formatHuf(g.spent),
        orderCount: g.orderCount,
        aovFormatted: formatHuf(aovG),
        buyers: g.buyers.size,
        discountPercent: discPct,
        shippingPercent: shipPct,
        loadPercent: loadPct,
        widgetPercent: wPct,
        nrrPercent: gNrr,
      };
    });

  const rangeLabel =
    months === 3
      ? "Utolsó 3 hónap"
      : months === 6
        ? "Utolsó 6 hónap"
        : months === 24
          ? "Utolsó 24 hónap"
          : "Utolsó 12 hónap";

  const data: ShopReport = {
    rangeMonths: months,
    rangeLabel,
    sampleOrderCount: all.length,
    truncated: all.length >= maxPages * 40,
    totals: {
      spent,
      spentFormatted: formatHuf(spent),
      orderCount,
      aov,
      aovFormatted: formatHuf(aov),
      deltaPercent,
      shipping,
      shippingFormatted: formatHuf(shipping),
      discount,
      discountFormatted: formatHuf(discount),
      shippingPercent:
        spent > 0 ? Math.round((shipping / spent) * 100) : null,
      discountPercent:
        spent > 0 ? Math.round((discount / spent) * 100) : null,
    },
    prev: {
      spent: prevSpent,
      spentFormatted: formatHuf(prevSpent),
      orderCount: prevRange.length,
    },
    partnerGrowth: {
      nrrPercent,
      sleepingCount,
      partnerFingerprintCount: partnerFingerprintIds.size,
      activePartnersInRange: activePartnerIds.size,
      medianDaysBetweenOrders,
      avgSkuPerActivePartner,
      widgetPercentOfPartner,
      partnerWidgetSpentFormatted: formatHuf(partnerWidgetSpent),
    },
    profit: {
      revenueWithCost,
      revenueWithCostFormatted: formatHuf(revenueWithCost),
      costTotal,
      costTotalFormatted: formatHuf(costTotal),
      grossProfit,
      grossProfitFormatted: formatHuf(grossProfit),
      marginPercent,
      coveragePercent,
      skuWithCost,
      skuTotal: skuListLen,
      excludesShippingAndFees: true,
      note: profitNote,
    },
    trend,
    mix: {
      guestSpent,
      guestSpentFormatted: formatHuf(guestSpent),
      guestPercent,
      guestOrderCount,
      guestBuyers: guestBuyers.size,
      newcomerSpent,
      newcomerSpentFormatted: formatHuf(newcomerSpent),
      newcomerPercent,
      newcomerOrderCount,
      newcomerBuyers: newcomerBuyers.size,
      partnerSpent,
      partnerSpentFormatted: formatHuf(partnerSpent),
      partnerPercent,
      partnerOrderCount,
      partnerBuyers: partnerBuyers.size,
      otherSpent,
      otherSpentFormatted: formatHuf(otherSpent),
      otherPercent,
      widgetSpent,
      widgetSpentFormatted: formatHuf(widgetSpent),
      widgetOrderCount,
      widgetPercent,
      storeSpent,
      storeSpentFormatted: formatHuf(storeSpent),
      storePercent,
    },
    movesInRange,
    activeBuyers: buyerKeys.size,
    groups,
    topPartners,
    topProducts,
  };

  const at = Date.now();
  summaryScratch.set(summaryKey, {
    at,
    months,
    inRange,
    report: data,
    partners,
  });
  reportCache.set(summaryKey, { at, data });
  if (needProducts) {
    reportCache.set(fullKey, { at, data });
  }
  return data;
}

async function mapCostsFromCatalog(
  client: PoolClient,
  shopId: string,
  skus: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const norms = [
    ...new Set(skus.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  for (const n of norms) out.set(n, null);
  if (!norms.length) return out;
  try {
    const res = await query<{ sku_norm: string; cost_net: string | null }>(
      client,
      `select sku_norm, cost_net::text as cost_net
       from product_catalog
       where shop_id = $1
         and active
         and sku_norm = any($2::text[])`,
      [shopId, norms],
    );
    for (const row of res.rows) {
      const c = row.cost_net != null ? Number(row.cost_net) : NaN;
      out.set(
        row.sku_norm,
        Number.isFinite(c) && c > 0 ? Math.round(c) : null,
      );
    }
  } catch {
    /* catalog missing */
  }
  return out;
}

async function computeProductBlock(
  config: ShoprenterConfig,
  client: PoolClient,
  shopId: string,
  sampleForProducts: CustomerOrderSummary[],
  partners: Map<string, PartnerAgg>,
): Promise<{
  topProducts: ShopReport["topProducts"];
  avgSkuPerActivePartner: number | null;
  revenueWithCost: number;
  costTotal: number;
  grossProfit: number;
  marginPercent: number | null;
  coveragePercent: number | null;
  skuWithCost: number;
  skuListLen: number;
  note: string;
}> {
  type LineLike = {
    sku?: string;
    modelNumber?: string;
    name?: string;
    quantity: number;
    lineTotalNet?: number;
    priceNet?: number;
    lineTotalGross?: number;
    priceGross?: number;
  };

  const orderLines: { order: CustomerOrderSummary; lines: LineLike[] }[] = [];
  const needDetail: CustomerOrderSummary[] = [];
  for (const o of sampleForProducts) {
    if (o.lines && o.lines.length) {
      orderLines.push({ order: o, lines: o.lines });
    } else {
      needDetail.push(o);
    }
  }

  const details = await mapPool(needDetail, DETAIL_CONCURRENCY, async (o) => {
    try {
      const detail = await getOrderDetailById(config, o.id);
      return { order: o, lines: detail.lines as LineLike[] };
    } catch {
      return null;
    }
  });
  for (const row of details) {
    if (row) orderLines.push(row);
  }

  const bySku = new Map<
    string,
    {
      sku: string;
      modelNumber: string | null;
      name: string | null;
      quantity: number;
      lineRevenue: number;
      lineRevenueNet: number;
    }
  >();

  for (const row of orderLines) {
    const key = buyerKey(row.order);
    const agg = partners.get(key);
    for (const line of row.lines) {
      if (isFeeOrShippingLine(line)) continue;
      const sku = (line.sku || line.modelNumber || "").trim();
      if (!sku) continue;
      const skuKey = sku.toUpperCase();
      if (agg) agg.skus.add(skuKey);
      const revGross = productLineGross(line);
      const revNet = productLineNet(line);
      const cur = bySku.get(skuKey) || {
        sku,
        modelNumber: line.modelNumber ?? null,
        name: line.name ?? null,
        quantity: 0,
        lineRevenue: 0,
        lineRevenueNet: 0,
      };
      if (!cur.modelNumber && line.modelNumber) cur.modelNumber = line.modelNumber;
      if (!cur.name && line.name) cur.name = line.name;
      cur.quantity += Math.max(1, line.quantity || 1);
      cur.lineRevenue += revGross;
      if (revNet != null) cur.lineRevenueNet += revNet;
      bySku.set(skuKey, cur);
    }
  }

  const partnerSkuCounts: number[] = [];
  for (const p of partners.values()) {
    if (p.isPartner === true && p.skus.size > 0) {
      partnerSkuCounts.push(p.skus.size);
    }
  }
  const avgSkuPerActivePartner =
    partnerSkuCounts.length > 0
      ? Math.round(
          (partnerSkuCounts.reduce((a, b) => a + b, 0) /
            partnerSkuCounts.length) *
            10,
        ) / 10
      : null;

  const skuList = [...bySku.values()];
  const costBySku = await mapCostsFromCatalog(
    client,
    shopId,
    skuList.slice(0, 40).map((p) => p.sku),
  );

  let revenueWithCost = 0;
  let revenueAllProductNet = 0;
  let costTotal = 0;
  let skuWithCost = 0;
  for (const p of skuList) {
    if (p.lineRevenueNet > 0) revenueAllProductNet += p.lineRevenueNet;
    const unitCost = costBySku.get(p.sku.toUpperCase());
    if (unitCost != null && unitCost > 0 && p.lineRevenueNet > 0) {
      skuWithCost += 1;
      const lineCost = Math.round(unitCost * p.quantity);
      revenueWithCost += p.lineRevenueNet;
      costTotal += lineCost;
    }
  }
  const grossProfit = revenueWithCost - costTotal;
  const marginPercent =
    revenueWithCost > 0
      ? Math.round((grossProfit / revenueWithCost) * 100)
      : null;
  const coveragePercent =
    revenueAllProductNet > 0
      ? Math.round((revenueWithCost / revenueAllProductNet) * 100)
      : null;

  const topProducts = skuList
    .sort((a, b) => b.lineRevenue - a.lineRevenue || b.quantity - a.quantity)
    .slice(0, 10)
    .map((p) => {
      const unitCost = costBySku.get(p.sku.toUpperCase());
      const hasCost = unitCost != null && unitCost > 0 && p.lineRevenueNet > 0;
      const lineCost = hasCost ? Math.round(unitCost! * p.quantity) : null;
      const m =
        hasCost && lineCost != null && p.lineRevenueNet > 0
          ? Math.round(((p.lineRevenueNet - lineCost) / p.lineRevenueNet) * 100)
          : null;
      return {
        sku: p.sku,
        modelNumber: p.modelNumber,
        name: p.name,
        quantity: p.quantity,
        lineRevenue: p.lineRevenue,
        lineRevenueFormatted: formatHuf(p.lineRevenue),
        costTotal: lineCost,
        costTotalFormatted: lineCost != null ? formatHuf(lineCost) : null,
        marginPercent: m,
        hasCost,
      };
    });

  const note =
    skuList.length === 0
      ? "Nincs terméktétel a mintában."
      : coveragePercent == null || coveragePercent === 0
        ? "Árrés = termék nettó − cost (catalog). Szállítás és utánvét nincs benne. Egyik SKU-nál sincs cost."
        : `Árrés = termék nettó − cost (catalog, szállítás nélkül). Lefedettség ${coveragePercent}% (${skuWithCost}/${skuList.length} SKU).`;

  return {
    topProducts,
    avgSkuPerActivePartner,
    revenueWithCost,
    costTotal,
    grossProfit,
    marginPercent,
    coveragePercent,
    skuWithCost,
    skuListLen: skuList.length,
    note,
  };
}

async function enrichReportProducts(
  config: ShoprenterConfig,
  client: PoolClient,
  shopId: string,
  scratch: SummaryScratch,
): Promise<ShopReport> {
  const sample = sampleOrdersForProducts(
    scratch.inRange,
    scratch.partners,
    PRODUCT_SAMPLE,
  );
  const block = await computeProductBlock(
    config,
    client,
    shopId,
    sample,
    scratch.partners,
  );
  return {
    ...scratch.report,
    partnerGrowth: {
      ...scratch.report.partnerGrowth,
      avgSkuPerActivePartner: block.avgSkuPerActivePartner,
    },
    profit: {
      revenueWithCost: block.revenueWithCost,
      revenueWithCostFormatted: formatHuf(block.revenueWithCost),
      costTotal: block.costTotal,
      costTotalFormatted: formatHuf(block.costTotal),
      grossProfit: block.grossProfit,
      grossProfitFormatted: formatHuf(block.grossProfit),
      marginPercent: block.marginPercent,
      coveragePercent: block.coveragePercent,
      skuWithCost: block.skuWithCost,
      skuTotal: block.skuListLen,
      excludesShippingAndFees: true,
      note: block.note,
    },
    topProducts: block.topProducts,
  };
}
