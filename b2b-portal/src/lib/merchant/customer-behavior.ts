/**
 * B2B partner státusz — tények (forgalom / ritmus), nem teendőlista.
 */

import type { CustomerOrderSummary } from "@/lib/shoprenter";
import { formatHuf } from "@/lib/shoprenter";

export type BehaviorStatus =
  | "no_orders"
  | "sleeping"
  | "declining"
  | "growing"
  | "stable";

export type PartnerBehavior = {
  status: BehaviorStatus;
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  decisionLine: string;
  daysSinceLastOrder: number | null;
  typicalDaysBetweenOrders: number | null;
  trend3mPercent: number | null;
  /** (szállítás + kedvezmény) / költés % */
  marginLoadPercent: number | null;
  last3mSpent: number;
  prev3mSpent: number;
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

function spentOf(o: CustomerOrderSummary): number {
  return Math.round(o.totalGross ?? o.total ?? 0);
}

function shippingOf(o: CustomerOrderSummary): number {
  return Math.round(o.shippingGross ?? o.shippingNet ?? 0);
}

function discountOf(o: CustomerOrderSummary): number {
  return Math.round(o.discountGross ?? 0);
}

export function buildPartnerBehavior(
  orders: CustomerOrderSummary[],
  opts?: { dueSoonCount?: number },
): PartnerBehavior {
  const now = Date.now();
  const times = orders
    .map((o) => Date.parse(o.dateCreated))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);

  const daysSinceLast =
    times.length > 0
      ? Math.max(0, Math.round((now - times[0]!) / dayMs(1)))
      : null;

  let typicalDays: number | null = null;
  if (times.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < Math.min(times.length - 1, 8); i++) {
      gaps.push((times[i]! - times[i + 1]!) / dayMs(1));
    }
    typicalDays = Math.max(1, Math.round(median(gaps)));
  }

  const threeMonths = dayMs(90);
  const sixMonths = dayMs(180);
  let last3 = 0;
  let prev3 = 0;
  let spentAll = 0;
  let shipAll = 0;
  let discAll = 0;
  for (const o of orders) {
    const t = Date.parse(o.dateCreated);
    if (!Number.isFinite(t)) continue;
    const s = spentOf(o);
    spentAll += s;
    shipAll += shippingOf(o);
    discAll += discountOf(o);
    const age = now - t;
    if (age <= threeMonths) last3 += s;
    else if (age <= sixMonths) prev3 += s;
  }

  let trend3mPercent: number | null = null;
  if (prev3 > 0) {
    trend3mPercent = Math.round(((last3 - prev3) / prev3) * 100);
  } else if (last3 > 0) {
    trend3mPercent = 100;
  }

  const marginLoadPercent =
    spentAll > 0
      ? Math.round(((shipAll + discAll) / spentAll) * 100)
      : null;

  let status: BehaviorStatus;
  if (orders.length === 0) status = "no_orders";
  else if (
    daysSinceLast != null &&
    daysSinceLast >= Math.max((typicalDays ?? 14) * 1.5, 30)
  ) {
    status = "sleeping";
  } else if (trend3mPercent != null && trend3mPercent <= -30) {
    status = "declining";
  } else if (trend3mPercent != null && trend3mPercent >= 20) {
    status = "growing";
  } else {
    status = "stable";
  }

  const labels: Record<BehaviorStatus, { label: string; tone: PartnerBehavior["tone"] }> = {
    no_orders: { label: "Új · nincs forgalom", tone: "neutral" },
    sleeping: { label: "Hallgat", tone: "warn" },
    declining: { label: "Csökken", tone: "danger" },
    growing: { label: "Nő", tone: "ok" },
    stable: { label: "Stabil", tone: "ok" },
  };

  const { label, tone } = labels[status];

  const facts: string[] = [];
  if (status === "no_orders") {
    facts.push("Nincs bolti rendelés");
  } else if (daysSinceLast != null) {
    facts.push(
      `Utolsó rendelés ${daysSinceLast} napja${
        typicalDays != null ? ` · szokás ~${typicalDays} nap` : ""
      }`,
    );
  }
  if (trend3mPercent != null) {
    facts.push(`3 hó trend ${trend3mPercent > 0 ? "+" : ""}${trend3mPercent}%`);
  }
  if (marginLoadPercent != null && marginLoadPercent >= 15) {
    facts.push(`száll.+kedv. ~${marginLoadPercent}%`);
  }
  const decisionLine = facts.join(" · ");

  return {
    status,
    label,
    tone,
    decisionLine,
    daysSinceLastOrder: daysSinceLast,
    typicalDaysBetweenOrders: typicalDays,
    trend3mPercent,
    marginLoadPercent,
    last3mSpent: last3,
    prev3mSpent: prev3,
  };
}

export function formatTrend(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export function behaviorSpentHint(b: PartnerBehavior): string {
  if (b.last3mSpent <= 0 && b.prev3mSpent <= 0) return "";
  return `3 hó: ${formatHuf(b.last3mSpent)} · előző 3 hó: ${formatHuf(b.prev3mSpent)}`;
}
