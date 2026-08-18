/**
 * Merchant Customer 360 — könnyű KPI a rendeléslistából (nincs N+1 detail fetch).
 */

import { formatHuf } from "@/lib/shoprenter";
import type { CustomerOrderSummary } from "@/lib/shoprenter";

export type MerchantCustomerStats = {
  orderCount: number;
  totalSpent: number;
  totalSpentFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  orderCount30d: number;
  totalSpent30d: number;
  totalSpent30dFormatted: string;
  daysSinceLastOrder: number | null;
  typicalDaysBetweenOrders: number | null;
  nextActionHint: string | null;
};

function dayMs(n: number) {
  return n * 24 * 60 * 60 * 1000;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function buildMerchantCustomerStats(
  orders: CustomerOrderSummary[],
): MerchantCustomerStats {
  const now = Date.now();
  const monthAgo = now - dayMs(30);
  const totalSpent = Math.round(
    orders.reduce((s, o) => s + (o.total || 0), 0),
  );
  const orders30 = orders.filter((o) => {
    const t = Date.parse(o.dateCreated);
    return Number.isFinite(t) && t >= monthAgo;
  });
  const spent30 = Math.round(
    orders30.reduce((s, o) => s + (o.total || 0), 0),
  );
  const avg =
    orders.length > 0
      ? Math.round(totalSpent / orders.length)
      : 0;

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

  const daysSinceLast =
    times.length > 0
      ? Math.max(0, Math.round((now - times[0]!) / dayMs(1)))
      : null;

  let nextActionHint: string | null = null;
  if (orders.length === 0) {
    nextActionHint =
      "Még nincs rendelése a boltból — érdemes felhívni / partner csoportba tenni.";
  } else if (daysSinceLast != null && typicalDays != null) {
    if (daysSinceLast >= typicalDays) {
      nextActionHint = `Szokásos ritmusa ~${typicalDays} nap — most jönne a következő kör (${daysSinceLast} napja hallgat).`;
    } else {
      nextActionHint = `Szokásos ritmus ~${typicalDays} nap. Kb. ${typicalDays - daysSinceLast} nap múlva esedékes.`;
    }
  } else if (daysSinceLast != null && daysSinceLast >= 30) {
    nextActionHint = `Már ${daysSinceLast} napja nem rendelt — sleeping partner?`;
  }

  return {
    orderCount: orders.length,
    totalSpent,
    totalSpentFormatted: formatHuf(totalSpent),
    avgOrderValue: avg,
    avgOrderValueFormatted: formatHuf(avg),
    orderCount30d: orders30.length,
    totalSpent30d: spent30,
    totalSpent30dFormatted: formatHuf(spent30),
    daysSinceLastOrder: daysSinceLast,
    typicalDaysBetweenOrders: typicalDays,
    nextActionHint,
  };
}
