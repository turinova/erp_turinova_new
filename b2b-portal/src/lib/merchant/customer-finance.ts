/**
 * Merchant Customer 360 — pénz riport (havi tábla, Δ%, tartomány, viselkedés).
 */

import { formatHuf } from "@/lib/shoprenter";
import type { CustomerOrderSummary } from "@/lib/shoprenter";
import {
  buildPartnerBehavior,
  type PartnerBehavior,
} from "@/lib/merchant/customer-behavior";

export type FinanceMonthRow = {
  key: string;
  year: number;
  month: number;
  label: string;
  orderCount: number;
  spent: number;
  spentFormatted: string;
  shipping: number;
  shippingFormatted: string;
  discount: number;
  discountFormatted: string;
  tax: number;
  taxFormatted: string;
  freeShippingOrders: number;
  /** Δ vs előző hónap a tartományban */
  deltaPercent: number | null;
  note: string | null;
};

export type FinanceYearRow = {
  year: number;
  orderCount: number;
  spent: number;
  spentFormatted: string;
  shipping: number;
  shippingFormatted: string;
  discount: number;
  discountFormatted: string;
};

export type CustomerFinanceReport = {
  sampleOrderCount: number;
  rangeMonths: number;
  rangeLabel: string;
  totals: {
    spent: number;
    spentFormatted: string;
    shipping: number;
    shippingFormatted: string;
    paymentFees: number;
    paymentFeesFormatted: string;
    discount: number;
    discountFormatted: string;
    tax: number;
    taxFormatted: string;
    freeShippingOrders: number;
    freeShippingRate: number | null;
    /** Költés − szállítás − fiz.díj (becsült áru) */
    goodsEstimate: number;
    goodsEstimateFormatted: string;
    shippingPercent: number | null;
    discountPercent: number | null;
    marginLoadPercent: number | null;
  };
  thisMonth: FinanceMonthRow | null;
  prevMonth: FinanceMonthRow | null;
  monthDeltaPercent: number | null;
  thisYear: FinanceYearRow | null;
  prevYear: FinanceYearRow | null;
  byMonth: FinanceMonthRow[];
  byYear: FinanceYearRow[];
  behavior: PartnerBehavior;
  narrative: string;
};

export type FinanceRangeMonths = 3 | 6 | 12 | 24;

function monthLabel(year: number, month: number): string {
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "short",
    }).format(new Date(year, month - 1, 1));
  } catch {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
}

function orderSpent(o: CustomerOrderSummary): number {
  return Math.round(o.totalGross ?? o.total ?? 0);
}
function orderShipping(o: CustomerOrderSummary): number {
  return Math.round(o.shippingGross ?? o.shippingNet ?? 0);
}
function orderDiscount(o: CustomerOrderSummary): number {
  return Math.round(o.discountGross ?? 0);
}
function orderTax(o: CustomerOrderSummary): number {
  return Math.round(o.tax ?? 0);
}
function orderPaymentFee(o: CustomerOrderSummary): number {
  return Math.round(o.paymentGross ?? 0);
}

function emptyMonth(year: number, month: number): FinanceMonthRow {
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month,
    label: monthLabel(year, month),
    orderCount: 0,
    spent: 0,
    spentFormatted: formatHuf(0),
    shipping: 0,
    shippingFormatted: formatHuf(0),
    discount: 0,
    discountFormatted: formatHuf(0),
    tax: 0,
    taxFormatted: formatHuf(0),
    freeShippingOrders: 0,
    deltaPercent: null,
    note: null,
  };
}

function finalizeMonth(m: FinanceMonthRow): FinanceMonthRow {
  return {
    ...m,
    spentFormatted: formatHuf(m.spent),
    shippingFormatted: formatHuf(m.shipping),
    discountFormatted: formatHuf(m.discount),
    taxFormatted: formatHuf(m.tax),
  };
}

function monthNote(m: FinanceMonthRow): string | null {
  if (m.orderCount === 0) return "Üres";
  if (m.deltaPercent != null && m.deltaPercent <= -40) return "Gyenge";
  if (m.deltaPercent != null && m.deltaPercent >= 40) return "Erős";
  return null;
}

export function buildCustomerFinanceReport(
  orders: CustomerOrderSummary[],
  opts?: { months?: FinanceRangeMonths; dueSoonCount?: number },
): CustomerFinanceReport {
  const rangeMonths = (opts?.months ?? 12) as FinanceRangeMonths;
  const byMonthMap = new Map<string, FinanceMonthRow>();
  const byYearMap = new Map<number, FinanceYearRow>();

  let spent = 0;
  let shipping = 0;
  let paymentFees = 0;
  let discount = 0;
  let tax = 0;
  let freeShippingOrders = 0;

  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const rangeStart = new Date(cy, cm - rangeMonths, 1).getTime();

  for (const o of orders) {
    const t = Date.parse(o.dateCreated);
    if (!Number.isFinite(t)) continue;
    // Aggregálunk mindent a year/statushoz; a byMonth tartományt később vágjuk
    const d = new Date(t);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const s = orderSpent(o);
    const sh = orderShipping(o);
    const disc = orderDiscount(o);
    const tx = orderTax(o);
    const pf = orderPaymentFee(o);

    if (t >= rangeStart) {
      spent += s;
      shipping += sh;
      paymentFees += pf;
      discount += disc;
      tax += tx;
      if (sh === 0) freeShippingOrders += 1;
    }

    let m = byMonthMap.get(key);
    if (!m) {
      m = emptyMonth(year, month);
      byMonthMap.set(key, m);
    }
    m.orderCount += 1;
    m.spent += s;
    m.shipping += sh;
    m.discount += disc;
    m.tax += tx;
    if (sh === 0) m.freeShippingOrders += 1;

    let y = byYearMap.get(year);
    if (!y) {
      y = {
        year,
        orderCount: 0,
        spent: 0,
        spentFormatted: formatHuf(0),
        shipping: 0,
        shippingFormatted: formatHuf(0),
        discount: 0,
        discountFormatted: formatHuf(0),
      };
      byYearMap.set(year, y);
    }
    y.orderCount += 1;
    y.spent += s;
    y.shipping += sh;
    y.discount += disc;
  }

  // Chronological months in range (oldest → newest) for delta
  const chrono: FinanceMonthRow[] = [];
  for (let i = rangeMonths - 1; i >= 0; i--) {
    const d = new Date(cy, cm - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    chrono.push(finalizeMonth(byMonthMap.get(key) ?? emptyMonth(y, m)));
  }
  for (let i = 0; i < chrono.length; i++) {
    const cur = chrono[i]!;
    const prev = i > 0 ? chrono[i - 1] : null;
    if (prev && prev.spent > 0) {
      cur.deltaPercent = Math.round(
        ((cur.spent - prev.spent) / prev.spent) * 100,
      );
    } else if (prev && cur.spent > 0) {
      cur.deltaPercent = 100;
    } else {
      cur.deltaPercent = null;
    }
    cur.note = monthNote(cur);
  }

  const byMonth = [...chrono].reverse(); // newest first
  const thisMonth = byMonth[0] ?? null;
  const prevMonth = byMonth[1] ?? null;
  const monthDeltaPercent = thisMonth?.deltaPercent ?? null;

  const thisYearRaw = byYearMap.get(cy) ?? {
    year: cy,
    orderCount: 0,
    spent: 0,
    spentFormatted: formatHuf(0),
    shipping: 0,
    shippingFormatted: formatHuf(0),
    discount: 0,
    discountFormatted: formatHuf(0),
  };
  const prevYearRaw = byYearMap.get(cy - 1) ?? null;
  const thisYear: FinanceYearRow = {
    ...thisYearRaw,
    spentFormatted: formatHuf(thisYearRaw.spent),
    shippingFormatted: formatHuf(thisYearRaw.shipping),
    discountFormatted: formatHuf(thisYearRaw.discount),
  };
  const prevYear: FinanceYearRow | null = prevYearRaw
    ? {
        ...prevYearRaw,
        spentFormatted: formatHuf(prevYearRaw.spent),
        shippingFormatted: formatHuf(prevYearRaw.shipping),
        discountFormatted: formatHuf(prevYearRaw.discount),
      }
    : null;

  const byYear = [...byYearMap.values()]
    .sort((a, b) => b.year - a.year)
    .map((y) => ({
      ...y,
      spentFormatted: formatHuf(y.spent),
      shippingFormatted: formatHuf(y.shipping),
      discountFormatted: formatHuf(y.discount),
    }));

  const ordersInRange = orders.filter((o) => {
    const t = Date.parse(o.dateCreated);
    return Number.isFinite(t) && t >= rangeStart;
  });

  const freeShippingRate =
    ordersInRange.length > 0
      ? Math.round((freeShippingOrders / ordersInRange.length) * 100)
      : null;

  const goodsEstimate = Math.max(0, spent - shipping - paymentFees);
  const shippingPercent =
    spent > 0 ? Math.round((shipping / spent) * 100) : null;
  const discountPercent =
    spent > 0 ? Math.round((discount / spent) * 100) : null;
  const marginLoadPercent =
    spent > 0
      ? Math.round(((shipping + discount) / spent) * 100)
      : null;

  const behavior = buildPartnerBehavior(orders, {
    dueSoonCount: opts?.dueSoonCount,
  });

  const rangeLabel =
    rangeMonths === 3
      ? "Utolsó 3 hónap"
      : rangeMonths === 6
        ? "Utolsó 6 hónap"
        : rangeMonths === 24
          ? "Utolsó 24 hónap"
          : "Utolsó 12 hónap";

  const narrative = `${rangeLabel}: ${formatHuf(spent)} · ${ordersInRange.length} rendelés · szállítás ${formatHuf(shipping)} (${shippingPercent ?? 0}%) · kedvezmény ${formatHuf(discount)} (${discountPercent ?? 0}%).`;

  return {
    sampleOrderCount: orders.length,
    rangeMonths,
    rangeLabel,
    totals: {
      spent,
      spentFormatted: formatHuf(spent),
      shipping,
      shippingFormatted: formatHuf(shipping),
      paymentFees,
      paymentFeesFormatted: formatHuf(paymentFees),
      discount,
      discountFormatted: formatHuf(discount),
      tax,
      taxFormatted: formatHuf(tax),
      freeShippingOrders,
      freeShippingRate,
      goodsEstimate,
      goodsEstimateFormatted: formatHuf(goodsEstimate),
      shippingPercent,
      discountPercent,
      marginLoadPercent,
    },
    thisMonth,
    prevMonth,
    monthDeltaPercent,
    thisYear,
    prevYear,
    byMonth,
    byYear,
    behavior,
    narrative,
  };
}
