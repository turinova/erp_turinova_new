/**
 * Bolt-szintű Riport a syncelt shop_order_facts / line_facts táblákból.
 * Mezők: ugyanaz a ShopReport shape, mint a live Shoprenter buildnél.
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { formatHuf } from "@/lib/shoprenter";
import { listGroupMap } from "@/lib/merchant/customer-group-map";
import type { ReportMonths, ShopReport } from "@/lib/merchant/shop-report";

type OrderFactRow = {
  id: string;
  sr_order_id: string;
  date_created: Date | string;
  email: string | null;
  customer_name: string | null;
  sr_customer_inner_id: number | null;
  sr_group_inner_id: number | null;
  status_name: string | null;
  total_gross: string | number;
  shipping_gross: string | number;
  discount_gross: string | number;
  source_guess: string | null;
};

type LineFactRow = {
  order_fact_id: string;
  sku: string | null;
  sku_norm: string | null;
  model_number: string | null;
  name: string | null;
  quantity: string | number;
  line_gross: string | number;
  line_net: string | number | null;
  is_fee_or_shipping: boolean;
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

function dayMs(n: number): number {
  return n * 24 * 60 * 60 * 1000;
}

function toMs(raw: Date | string | null | undefined): number {
  if (raw == null) return 0;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  const s = String(raw).trim();
  if (!s) return 0;
  const iso = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isFinite(iso) ? iso : 0;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v: string | number | null | undefined): number {
  return Math.round(num(v));
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

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function buyerKey(o: {
  sr_customer_inner_id: number | null;
  email: string | null;
  sr_order_id: string;
}): string {
  if (o.sr_customer_inner_id != null) return `id:${o.sr_customer_inner_id}`;
  if (o.email) return `em:${o.email}`;
  return `ord:${o.sr_order_id}`;
}

function isCancelledStatus(statusName: string | null): boolean {
  if (!statusName) return false;
  const s = statusName.toLowerCase();
  return s.includes("storn") || s.includes("cancel");
}

function rangeLabelFor(months: ReportMonths): string {
  if (months === 3) return "Utolsó 3 hónap";
  if (months === 6) return "Utolsó 6 hónap";
  if (months === 24) return "Utolsó 24 hónap";
  return "Utolsó 12 hónap";
}

export async function orderFactsSchemaReady(
  client: PoolClient,
): Promise<boolean> {
  try {
    const res = await query<{ reg: string | null }>(
      client,
      `select to_regclass('public.shop_order_facts')::text as reg`,
    );
    return Boolean(res.rows[0]?.reg);
  } catch {
    return false;
  }
}

/** Max age of newest mirrored order before we distrust the DB and fall back to live. */
const ORDER_FACTS_FRESH_MS = dayMs(14);

async function recentWindowHasOrders(
  client: PoolClient,
  shopId: string,
  fromMs: number,
  toMs: number,
): Promise<{ ok: boolean; hint?: string }> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n
     from shop_order_facts
     where shop_id = $1
       and date_created >= to_timestamp($2 / 1000.0)
       and date_created <= to_timestamp($3 / 1000.0)`,
    [shopId, fromMs, toMs],
  );
  const n = Number(res.rows[0]?.n ?? 0);
  if (n > 0) return { ok: true };
  return {
    ok: false,
    hint: "A tükörben nincs rendelés a legutóbbi hónapokban. Élő adat.",
  };
}

/**
 * DB mirror is usable only if:
 * - we have facts rows
 * - newest order in the mirror is recent enough (not a stale backfill hole)
 * - oldest reaches far enough for the selected window (or ≥80% of it)
 * - the recent end of the window is not empty
 */
export async function orderFactsCoverageOk(
  client: PoolClient,
  shopId: string,
  months: ReportMonths,
): Promise<{ ok: boolean; hint?: string; newestSyncedAt?: string | null }> {
  try {
    const [stateRes, factsRes] = await Promise.all([
      query<{
        oldest_synced_at: Date | string | null;
        newest_synced_at: Date | string | null;
      }>(
        client,
        `select oldest_synced_at, newest_synced_at
         from shop_report_sync_state
         where shop_id = $1`,
        [shopId],
      ),
      query<{
        oldest_fact_at: Date | string | null;
        newest_fact_at: Date | string | null;
        fact_count: string;
      }>(
        client,
        `select
           min(date_created) as oldest_fact_at,
           max(date_created) as newest_fact_at,
           count(*)::text as fact_count
         from shop_order_facts
         where shop_id = $1`,
        [shopId],
      ),
    ]);

    const row = stateRes.rows[0];
    const facts = factsRes.rows[0];
    const factCount = Number(facts?.fact_count ?? 0);

    if (!row && factCount === 0) {
      return { ok: false, hint: "Még nincs sync" };
    }

    const newestFactMs = toMs(facts?.newest_fact_at);
    const oldestFactMs = toMs(facts?.oldest_fact_at);
    const newestStateMs = toMs(row?.newest_synced_at);
    const oldestStateMs = toMs(row?.oldest_synced_at);

    const newestMs = Math.max(newestFactMs || 0, newestStateMs || 0) || 0;
    const oldestMs =
      [oldestFactMs, oldestStateMs].filter((n) => n > 0).sort((a, b) => a - b)[0] ??
      0;

    const newestSyncedAt =
      newestMs > 0 ? new Date(newestMs).toISOString() : null;

    if (factCount === 0 || !newestMs) {
      return {
        ok: false,
        hint: "A sync még nem töltött rendelést a tükörbe",
        newestSyncedAt,
      };
    }

    const now = Date.now();

    // Stale newest end → empty recent months on charts (live is safer).
    if (now - newestMs > ORDER_FACTS_FRESH_MS) {
      const days = Math.max(1, Math.round((now - newestMs) / dayMs(1)));
      return {
        ok: false,
        hint: `A tükör legfrissebb rendelése ~${days} napos. Frissítésig élő adat.`,
        newestSyncedAt,
      };
    }

    if (!oldestMs) {
      return {
        ok: false,
        hint: "A sync még nem ért el elég messzire a múltba",
        newestSyncedAt,
      };
    }

    const rangeMs = dayMs(months * 30);
    const idealOldest = now - rangeMs;

    if (oldestMs <= idealOldest) {
      // Also require no large hole in the newest half of the window
      // (e.g. missing Jun–Aug while older months exist).
      const hole = await recentWindowHasOrders(
        client,
        shopId,
        Math.max(idealOldest, now - dayMs(Math.min(months, 3) * 30)),
        now,
      );
      if (!hole.ok) {
        return {
          ok: false,
          hint: hole.hint ?? "A tükörben hiányzik a közelmúlt",
          newestSyncedAt,
        };
      }
      return { ok: true, newestSyncedAt };
    }

    const coveredMs = Math.max(0, now - oldestMs);
    if (coveredMs >= rangeMs * 0.8) {
      const hole = await recentWindowHasOrders(
        client,
        shopId,
        Math.max(oldestMs, now - dayMs(Math.min(months, 3) * 30)),
        now,
      );
      if (!hole.ok) {
        return {
          ok: false,
          hint: hole.hint ?? "A tükörben hiányzik a közelmúlt",
          newestSyncedAt,
        };
      }
      return { ok: true, newestSyncedAt };
    }

    return {
      ok: false,
      hint: `A syncelt időszak még rövid a választott ${months} hónaphoz`,
      newestSyncedAt,
    };
  } catch {
    return { ok: false, hint: "Még nincs sync" };
  }
}

/** Useful for callers that only need the window bounds. */
export function reportWindowMs(
  months: ReportMonths,
  nowMs: number = Date.now(),
): { now: number; rangeStart: number; prevStart: number; rangeMs: number } {
  const rangeMs = dayMs(months * 30);
  const rangeStart = nowMs - rangeMs;
  return {
    now: nowMs,
    rangeStart,
    prevStart: rangeStart - rangeMs,
    rangeMs,
  };
}

export async function buildShopReportFromDb(
  client: PoolClient,
  shopId: string,
  months: ReportMonths,
): Promise<ShopReport> {
  const { now, rangeStart, prevStart } = reportWindowMs(months);
  const coverage = await orderFactsCoverageOk(client, shopId, months);

  const ordersRes = await query<OrderFactRow>(
    client,
    `select id, sr_order_id, date_created, email, customer_name,
            sr_customer_inner_id, sr_group_inner_id, status_name,
            total_gross, shipping_gross, discount_gross, source_guess
     from shop_order_facts
     where shop_id = $1
       and date_created >= to_timestamp($2 / 1000.0)
       and date_created <= to_timestamp($3 / 1000.0)
       and (
         status_name is null
         or (
           status_name not ilike '%storn%'
           and status_name not ilike '%cancel%'
         )
       )`,
    [shopId, prevStart, now],
  );

  const all = ordersRes.rows.filter((o) => !isCancelledStatus(o.status_name));
  const inRange = all.filter((o) => {
    const t = toMs(o.date_created);
    return t >= rangeStart && t <= now;
  });
  const prevRange = all.filter((o) => {
    const t = toMs(o.date_created);
    return t >= prevStart && t < rangeStart;
  });

  let spent = 0;
  let shipping = 0;
  let discount = 0;
  for (const o of inRange) {
    spent += roundMoney(o.total_gross);
    shipping += roundMoney(o.shipping_gross);
    discount += roundMoney(o.discount_gross);
  }
  let prevSpent = 0;
  for (const o of prevRange) prevSpent += roundMoney(o.total_gross);

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
    const t = toMs(o.date_created);
    if (!t) continue;
    const key = monthKey(t);
    const cur = byMonth.get(key) || { spent: 0, orderCount: 0 };
    cur.spent += roundMoney(o.total_gross);
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

  const [mapResult, fpResult, widgetResult, widgetCntResult, movesResult] =
    await Promise.all([
      listGroupMap(client, shopId).catch(() => [] as Awaited<
        ReturnType<typeof listGroupMap>
      >),
      query<{
        sr_customer_inner_id: number;
        sr_group_inner_id: number | null;
      }>(
        client,
        `select sr_customer_inner_id, sr_group_inner_id
         from shop_customers
         where shop_id = $1 and sr_status = 'active'`,
        [shopId],
      ).catch(() => ({
        rows: [] as {
          sr_customer_inner_id: number;
          sr_group_inner_id: number | null;
        }[],
      })),
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
      ).catch(() => ({
        rows: [] as { sr_customer_inner_id: number | null; sum: string | null }[],
      })),
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

  for (const row of mapResult) {
    roleByGroup.set(row.sr_group_inner_id, row.role);
    if (row.sr_name_snapshot) {
      groupNameById.set(row.sr_group_inner_id, row.sr_name_snapshot);
    }
    if (row.is_default_in_sr) defaultGroupId = row.sr_group_inner_id;
  }

  for (const row of fpResult.rows) {
    groupByInner.set(row.sr_customer_inner_id, row.sr_group_inner_id);
    if (defaultGroupId != null) {
      const isPartner =
        row.sr_group_inner_id != null &&
        row.sr_group_inner_id !== defaultGroupId;
      partnerByInner.set(row.sr_customer_inner_id, isPartner);
      if (isPartner) partnerFingerprintIds.add(row.sr_customer_inner_id);
    } else if (row.sr_group_inner_id != null) {
      // Nincs alap csoport a mapben → minden csoportos partner
      partnerByInner.set(row.sr_customer_inner_id, true);
      partnerFingerprintIds.add(row.sr_customer_inner_id);
    }
  }

  let b2bWidgetSpent = 0;
  for (const row of widgetResult.rows) {
    const s = Math.round(Number(row.sum || 0));
    b2bWidgetSpent += s;
    if (row.sr_customer_inner_id == null) continue;
    widgetByInner.set(row.sr_customer_inner_id, s);
  }
  let widgetOrderCount = Number(widgetCntResult.rows[0]?.cnt || 0);
  const movesInRange = Number(movesResult.rows[0]?.cnt || 0);

  // Fallback: source_guess a facts-ből, ha nincs b2b_orders widget adat
  let sourceWidgetSpent = 0;
  let sourceWidgetOrderCount = 0;
  for (const o of inRange) {
    if (o.source_guess === "widget") {
      sourceWidgetSpent += roundMoney(o.total_gross);
      sourceWidgetOrderCount += 1;
    }
  }
  let widgetSpent = b2bWidgetSpent;
  if (widgetOrderCount <= 0 && sourceWidgetOrderCount > 0) {
    widgetSpent = sourceWidgetSpent;
    widgetOrderCount = sourceWidgetOrderCount;
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

  function resolveSegment(o: OrderFactRow): {
    segment: "guest" | "newcomer" | "partner" | "other";
    isPartner: boolean | null;
    groupInnerId: number | null;
  } {
    if (o.sr_customer_inner_id == null) {
      return { segment: "guest", isPartner: null, groupInnerId: null };
    }

    let groupInnerId =
      groupByInner.get(o.sr_customer_inner_id) ??
      o.sr_group_inner_id ??
      null;

    let isPartner: boolean | null = null;
    if (partnerByInner.has(o.sr_customer_inner_id)) {
      isPartner = partnerByInner.get(o.sr_customer_inner_id)!;
    } else if (defaultGroupId != null && groupInnerId != null) {
      isPartner = groupInnerId !== defaultGroupId;
    } else if (defaultGroupId == null && groupInnerId != null) {
      isPartner = true;
    }

    if (isPartner === true) {
      return { segment: "partner", isPartner, groupInnerId };
    }
    if (isPartner === false) {
      return { segment: "newcomer", isPartner, groupInnerId };
    }
    return { segment: "other", isPartner, groupInnerId };
  }

  for (const o of prevRange) {
    const key = buyerKey(o);
    const s = roundMoney(o.total_gross);
    prevPartnerSpend.set(key, (prevPartnerSpend.get(key) || 0) + s);
    const { groupInnerId } = resolveSegment(o);
    if (groupInnerId != null) {
      ensureGroup(groupInnerId).prevSpent += s;
    }
  }

  for (const o of inRange) {
    const s = roundMoney(o.total_gross);
    const ship = roundMoney(o.shipping_gross);
    const disc = roundMoney(o.discount_gross);
    const key = buyerKey(o);
    buyerKeys.add(key);

    const { segment, isPartner, groupInnerId } = resolveSegment(o);

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
      if (o.sr_customer_inner_id != null) {
        activePartnerIds.add(o.sr_customer_inner_id);
      }
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
      name: o.customer_name || o.email || `Rendelés ${o.sr_order_id}`,
      email: o.email ?? null,
      customerInnerId: o.sr_customer_inner_id ?? null,
      groupInnerId,
      isPartner,
      orderCount: 0,
      spent: 0,
      shipping: 0,
      discount: 0,
      times: [],
      skus: new Set<string>(),
    };
    if (
      o.customer_name &&
      (!agg.name || agg.name.startsWith("Rendelés"))
    ) {
      agg.name = o.customer_name;
    }
    if (o.email && !agg.email) agg.email = o.email;
    if (o.sr_customer_inner_id != null) {
      agg.customerInnerId = o.sr_customer_inner_id;
    }
    if (groupInnerId != null) agg.groupInnerId = groupInnerId;
    if (isPartner != null) agg.isPartner = isPartner;
    agg.orderCount += 1;
    agg.spent += s;
    agg.shipping += ship;
    agg.discount += disc;
    const t = toMs(o.date_created);
    if (t) agg.times.push(t);
    partners.set(key, agg);
  }

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

  const storeSpent = Math.max(0, spent - widgetSpent);
  const widgetPercent =
    spent > 0 ? Math.round((Math.min(widgetSpent, spent) / spent) * 100) : null;
  const storePercent =
    spent > 0 ? Math.round((storeSpent / spent) * 100) : null;

  let nrrBase = 0;
  let nrrNow = 0;
  for (const [key, prevS] of prevPartnerSpend) {
    const agg = partners.get(key);
    const wasPartner =
      agg?.isPartner === true ||
      (agg?.customerInnerId != null &&
        partnerByInner.get(agg.customerInnerId) === true);
    if (!wasPartner && !agg) {
      const m = /^id:(\d+)$/.exec(key);
      if (m && partnerByInner.get(Number(m[1])) === true) {
        nrrBase += prevS;
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

  // Termékek + cost a line facts + catalog-ból
  const inRangeIds = inRange.map((o) => o.id);
  const orderIdByFact = new Map(inRange.map((o) => [o.id, o]));

  let topProducts: ShopReport["topProducts"] = [];
  let avgSkuPerActivePartner: number | null = null;
  let revenueWithCost = 0;
  let costTotal = 0;
  let grossProfit = 0;
  let marginPercent: number | null = null;
  let coveragePercent: number | null = null;
  let skuWithCost = 0;
  let skuListLen = 0;
  let profitNote = "Nincs terméktétel a syncelt rendelésekben.";

  if (inRangeIds.length > 0) {
    const linesRes = await query<LineFactRow>(
      client,
      `select order_fact_id, sku, sku_norm, model_number, name,
              quantity, line_gross, line_net, is_fee_or_shipping
       from shop_order_line_facts
       where shop_id = $1
         and order_fact_id = any($2::uuid[])
         and not is_fee_or_shipping`,
      [shopId, inRangeIds],
    );

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

    for (const line of linesRes.rows) {
      const order = orderIdByFact.get(line.order_fact_id);
      if (!order) continue;
      const key = buyerKey(order);
      const agg = partners.get(key);
      const skuRaw = (line.sku || line.model_number || "").trim();
      const skuNorm =
        (line.sku_norm || skuRaw).trim().toUpperCase() || null;
      if (!skuNorm) continue;
      if (agg) agg.skus.add(skuNorm);

      const qty = Math.max(1, Math.round(num(line.quantity)) || 1);
      const revGross = roundMoney(line.line_gross);
      const revNet =
        line.line_net != null && Number.isFinite(num(line.line_net))
          ? roundMoney(line.line_net)
          : null;

      const cur = bySku.get(skuNorm) || {
        sku: line.sku?.trim() || skuNorm,
        modelNumber: line.model_number ?? null,
        name: line.name ?? null,
        quantity: 0,
        lineRevenue: 0,
        lineRevenueNet: 0,
      };
      if (!cur.modelNumber && line.model_number) {
        cur.modelNumber = line.model_number;
      }
      if (!cur.name && line.name) cur.name = line.name;
      cur.quantity += qty;
      cur.lineRevenue += revGross;
      if (revNet != null) cur.lineRevenueNet += revNet;
      bySku.set(skuNorm, cur);
    }

    const partnerSkuCounts: number[] = [];
    for (const p of partners.values()) {
      if (p.isPartner === true && p.skus.size > 0) {
        partnerSkuCounts.push(p.skus.size);
      }
    }
    avgSkuPerActivePartner =
      partnerSkuCounts.length > 0
        ? Math.round(
            (partnerSkuCounts.reduce((a, b) => a + b, 0) /
              partnerSkuCounts.length) *
              10,
          ) / 10
        : null;

    const skuList = [...bySku.values()];
    skuListLen = skuList.length;
    const norms = skuList.map((p) => p.sku.toUpperCase());
    const costBySku = new Map<string, number | null>();
    for (const n of norms) costBySku.set(n, null);

    if (norms.length > 0) {
      try {
        const costRes = await query<{
          sku_norm: string;
          cost_net: string | null;
        }>(
          client,
          `select sku_norm, cost_net::text as cost_net
           from product_catalog
           where shop_id = $1
             and active
             and sku_norm = any($2::text[])`,
          [shopId, [...new Set(norms)]],
        );
        for (const row of costRes.rows) {
          const c = row.cost_net != null ? Number(row.cost_net) : NaN;
          costBySku.set(
            row.sku_norm,
            Number.isFinite(c) && c > 0 ? Math.round(c) : null,
          );
        }
      } catch {
        /* catalog missing */
      }
    }

    let revenueAllProductNet = 0;
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
    grossProfit = revenueWithCost - costTotal;
    marginPercent =
      revenueWithCost > 0
        ? Math.round((grossProfit / revenueWithCost) * 100)
        : null;
    coveragePercent =
      revenueAllProductNet > 0
        ? Math.round((revenueWithCost / revenueAllProductNet) * 100)
        : null;

    topProducts = skuList
      .sort(
        (a, b) =>
          b.lineRevenue - a.lineRevenue || b.quantity - a.quantity,
      )
      .slice(0, 10)
      .map((p) => {
        const unitCost = costBySku.get(p.sku.toUpperCase());
        const hasCost =
          unitCost != null && unitCost > 0 && p.lineRevenueNet > 0;
        const lineCost = hasCost
          ? Math.round(unitCost! * p.quantity)
          : null;
        const m =
          hasCost && lineCost != null && p.lineRevenueNet > 0
            ? Math.round(
                ((p.lineRevenueNet - lineCost) / p.lineRevenueNet) * 100,
              )
            : null;
        return {
          sku: p.sku,
          modelNumber: p.modelNumber,
          name: p.name,
          quantity: p.quantity,
          lineRevenue: p.lineRevenue,
          lineRevenueFormatted: formatHuf(p.lineRevenue),
          costTotal: lineCost,
          costTotalFormatted:
            lineCost != null ? formatHuf(lineCost) : null,
          marginPercent: m,
          hasCost,
        };
      });

    profitNote =
      skuList.length === 0
        ? "Nincs terméktétel a syncelt rendelésekben."
        : coveragePercent == null || coveragePercent === 0
          ? "Árrés = termék nettó − cost (catalog). Szállítás és utánvét nincs benne. Egyik SKU-nál sincs cost."
          : `Árrés = termék nettó − cost (catalog, szállítás nélkül). Lefedettség ${coveragePercent}% (${skuWithCost}/${skuList.length} SKU).`;
  }

  const widgetPercentOfPartner =
    partnerSpent > 0
      ? Math.round(
          (Math.min(partnerWidgetSpent, partnerSpent) / partnerSpent) * 100,
        )
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
          groupNameById.get(g.groupInnerId) ||
          `Csoport #${g.groupInnerId}`,
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

  return {
    rangeMonths: months,
    rangeLabel: rangeLabelFor(months),
    sampleOrderCount: inRange.length,
    truncated: !coverage.ok,
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
      guestPercent: pctOf(guestSpent),
      guestOrderCount,
      guestBuyers: guestBuyers.size,
      newcomerSpent,
      newcomerSpentFormatted: formatHuf(newcomerSpent),
      newcomerPercent: pctOf(newcomerSpent),
      newcomerOrderCount,
      newcomerBuyers: newcomerBuyers.size,
      partnerSpent,
      partnerSpentFormatted: formatHuf(partnerSpent),
      partnerPercent: pctOf(partnerSpent),
      partnerOrderCount,
      partnerBuyers: partnerBuyers.size,
      otherSpent,
      otherSpentFormatted: formatHuf(otherSpent),
      otherPercent: pctOf(otherSpent),
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
}
