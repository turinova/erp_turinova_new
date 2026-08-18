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
  resolveProductBySku,
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

function dayMs(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

/** Shoprenter: "2024-03-15 12:30:00" — Date.parse gyakran NaN. */
function parseOrderTime(raw: string | null | undefined): number {
  if (!raw || !raw.trim()) return 0;
  const s = raw.trim();
  const iso = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  if (Number.isFinite(iso)) return iso;
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return 0;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0),
  ).getTime();
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
): Promise<ShopReport> {
  const hit = reportCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const now = Date.now();
  const rangeMs = dayMs(months * 30);
  const rangeStart = now - rangeMs;
  const prevStart = rangeStart - rangeMs;

  const maxPages = months <= 6 ? 6 : months <= 12 ? 8 : 10;
  const all = await listShopOrders(config, {
    dateFromMs: prevStart,
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
  try {
    const groups = await listCustomerGroups(config);
    for (const g of groups) {
      groupNameById.set(g.innerId, g.name);
      if (g.isDefault) defaultGroupId = g.innerId;
    }
  } catch {
    /* optional */
  }

  const roleByGroup = new Map<number, string>();
  try {
    const map = await listGroupMap(client, shopId);
    for (const row of map) {
      roleByGroup.set(row.sr_group_inner_id, row.role);
      if (row.sr_name_snapshot) {
        groupNameById.set(row.sr_group_inner_id, row.sr_name_snapshot);
      }
    }
  } catch {
    /* optional */
  }

  const partnerByInner = new Map<number, boolean>();
  const groupByInner = new Map<number, number | null>();
  const partnerFingerprintIds = new Set<number>();
  try {
    const fp = await query<{
      sr_customer_inner_id: number;
      sr_group_inner_id: number | null;
    }>(
      client,
      `select sr_customer_inner_id, sr_group_inner_id
       from shop_customers
       where shop_id = $1 and sr_status = 'active'`,
      [shopId],
    );
    for (const row of fp.rows) {
      groupByInner.set(row.sr_customer_inner_id, row.sr_group_inner_id);
      if (defaultGroupId == null) continue;
      const isPartner =
        row.sr_group_inner_id != null &&
        row.sr_group_inner_id !== defaultGroupId;
      partnerByInner.set(row.sr_customer_inner_id, isPartner);
      if (isPartner) partnerFingerprintIds.add(row.sr_customer_inner_id);
    }
  } catch {
    /* table may be empty */
  }

  const widgetByInner = new Map<number, number>();
  try {
    const wr = await query<{
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
    );
    for (const row of wr.rows) {
      if (row.sr_customer_inner_id == null) continue;
      widgetByInner.set(
        row.sr_customer_inner_id,
        Math.round(Number(row.sum || 0)),
      );
    }
  } catch {
    /* optional */
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
  try {
    const wr = await query<{ cnt: string }>(
      client,
      `select count(*)::text as cnt
       from b2b_orders
       where shop_id = $1
         and status <> 'cancelled'
         and created_at >= to_timestamp($2 / 1000.0)
         and created_at <= to_timestamp($3 / 1000.0)`,
      [shopId, rangeStart, now],
    );
    widgetOrderCount = Number(wr.rows[0]?.cnt || 0);
  } catch {
    /* optional */
  }

  const storeSpent = Math.max(0, spent - widgetSpent);
  const widgetPercent =
    spent > 0 ? Math.round((Math.min(widgetSpent, spent) / spent) * 100) : null;
  const storePercent =
    spent > 0 ? Math.round((storeSpent / spent) * 100) : null;

  let movesInRange = 0;
  try {
    const mr = await query<{ cnt: string }>(
      client,
      `select count(*)::text as cnt
       from shop_customer_group_moves
       where shop_id = $1
         and created_at >= to_timestamp($2 / 1000.0)
         and created_at <= to_timestamp($3 / 1000.0)`,
      [shopId, rangeStart, now],
    );
    movesInRange = Number(mr.rows[0]?.cnt || 0);
  } catch {
    /* optional */
  }

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

  const sampleForProducts = inRange.slice(0, 14);
  const details = await mapPool(sampleForProducts, 2, async (o) => {
    try {
      await new Promise((r) => setTimeout(r, 200));
      const detail = await getOrderDetailById(config, o.id);
      return { order: o, detail };
    } catch {
      return null;
    }
  });

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

  for (const row of details) {
    if (!row) continue;
    const key = buyerKey(row.order);
    const agg = partners.get(key);
    for (const line of row.detail.lines) {
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

  const widgetPercentOfPartner =
    partnerSpent > 0
      ? Math.round((Math.min(partnerWidgetSpent, partnerSpent) / partnerSpent) * 100)
      : null;

  // Költség lookup — csak unique SKU, hiányzó cost OK
  const skuList = [...bySku.values()];
  const costBySku = new Map<string, number | null>();
  await mapPool(skuList.slice(0, 40), 2, async (p) => {
    try {
      await new Promise((r) => setTimeout(r, 180));
      const resolved = await resolveProductBySku(config, p.sku);
      const c =
        resolved.hasCost && resolved.costNet != null && resolved.costNet > 0
          ? resolved.costNet
          : null;
      costBySku.set(p.sku.toUpperCase(), c);
    } catch {
      costBySku.set(p.sku.toUpperCase(), null);
    }
    return null;
  });

  let revenueWithCost = 0;
  let revenueAllProductNet = 0;
  let costTotal = 0;
  let skuWithCost = 0;
  for (const p of skuList) {
    // Árrés BÁZIS: csak termék nettó. Szállítás / utánvét / order total soha.
    if (p.lineRevenueNet > 0) revenueAllProductNet += p.lineRevenueNet;
    const unitCost = costBySku.get(p.sku.toUpperCase());
    if (
      unitCost != null &&
      unitCost > 0 &&
      p.lineRevenueNet > 0
    ) {
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
    truncated: all.length >= maxPages * 45,
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
      skuTotal: skuList.length,
      excludesShippingAndFees: true,
      note:
        skuList.length === 0
          ? "Nincs terméktétel a mintában."
          : coveragePercent == null || coveragePercent === 0
            ? "Árrés = termék nettó − cost. Szállítás és utánvét nincs benne. Egyik SKU-nál sincs kitöltve a cost."
            : `Árrés = termék nettó − cost (szállítás / utánvét nélkül). Lefedettség ${coveragePercent}% (${skuWithCost}/${skuList.length} SKU).`,
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

  reportCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
