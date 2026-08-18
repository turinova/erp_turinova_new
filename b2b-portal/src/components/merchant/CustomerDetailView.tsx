"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { gateFromBilling, UpgradeBanner } from "@/components/merchant/PartnerUsageBar";
import { isPartnerLocked, type PartnerGateDto } from "@/lib/billing/types";
import { relativeTime } from "@/lib/format";

type TabId = "finance" | "products" | "orders" | "profile";
type FinanceMonths = 3 | 6 | 12 | 24;

type BehaviorDto = {
  status: string;
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  decisionLine: string;
  daysSinceLastOrder: number | null;
  typicalDaysBetweenOrders: number | null;
  trend3mPercent: number | null;
  marginLoadPercent: number | null;
};

type AddressDto = {
  id: string;
  firstname: string;
  lastname: string;
  company: string | null;
  taxNumber: string | null;
  address1: string;
  address2: string | null;
  postcode: string;
  city: string;
  country: string | null;
  zone: string | null;
  telephone: string | null;
  type: string | null;
};

type OrderDto = {
  id: string;
  innerId: string;
  dateLabel: string;
  totalFormatted: string;
  shippingGross?: number;
  status: string;
  itemCount?: number;
};

type OrderLineDto = {
  sku: string;
  modelNumber: string | null;
  name: string | null;
  quantity: number;
  priceNetFormatted: string | null;
  priceGrossFormatted: string | null;
  lineTotalGrossFormatted: string | null;
  productUrl: string | null;
};

type OrderDetailDto = {
  id: string;
  innerId: string;
  dateLabel: string;
  status: string;
  totalFormatted: string;
  shippingFormatted: string | null;
  discountFormatted: string | null;
  paymentMethodName: string | null;
  shippingMethodName: string | null;
  itemCount: number;
  lines: OrderLineDto[];
};

type StatsDto = {
  orderCount: number;
  totalSpentFormatted: string;
  avgOrderValueFormatted: string;
  orderCount30d: number;
  totalSpent30dFormatted: string;
  daysSinceLastOrder: number | null;
  typicalDaysBetweenOrders: number | null;
  nextActionHint: string | null;
};

type CustomerDto = {
  innerId: number;
  email: string;
  name: string;
  telephone: string | null;
  approved: boolean;
  dateCreated: string | null;
  groupName: string | null;
  isPartner: boolean;
  company: string | null;
  taxNumber: string | null;
};

type MoveDto = {
  id: string;
  fromGroupName: string | null;
  toGroupName: string | null;
  createdAt: string;
};

type WidgetOrderDto = {
  id: string;
  grossTotal: number | null;
  lineCount: number;
  createdAt: string;
  status: string;
};

type FinanceMonth = {
  key: string;
  label: string;
  orderCount: number;
  spentFormatted: string;
  shippingFormatted: string;
  discountFormatted: string;
  deltaPercent: number | null;
  note: string | null;
};

type FinanceReport = {
  rangeMonths: number;
  rangeLabel: string;
  narrative: string;
  behavior: BehaviorDto;
  totals: {
    spentFormatted: string;
    shippingFormatted: string;
    discountFormatted: string;
    goodsEstimateFormatted: string;
    shippingPercent: number | null;
    discountPercent: number | null;
    marginLoadPercent: number | null;
    taxFormatted: string;
    paymentFeesFormatted: string;
    freeShippingRate: number | null;
  };
  thisMonth: FinanceMonth | null;
  prevMonth: FinanceMonth | null;
  monthDeltaPercent: number | null;
  thisYear: {
    year: number;
    spentFormatted: string;
    shippingFormatted: string;
    discountFormatted: string;
  } | null;
  prevYear: {
    year: number;
    spentFormatted: string;
    shippingFormatted: string;
    discountFormatted: string;
  } | null;
  byMonth: FinanceMonth[];
  sampleOrderCount: number;
};

type ProductRow = {
  sku: string;
  modelNumber?: string;
  name?: string;
  imageUrl?: string | null;
  productUrl?: string | null;
  lastPriceNetFormatted?: string;
  lastPriceGrossFormatted?: string;
  totalQty: number;
  orderCount: number;
  lastOrderedLabel: string;
  daysSince: number;
  suggestedQty?: number;
  flag: "due_soon" | "top" | null;
};

type ProductsReport = {
  products: ProductRow[];
  legend: string;
};

type DetailPayload = {
  customer: CustomerDto;
  addresses: AddressDto[];
  stats: StatsDto;
  behavior: BehaviorDto;
  orders: OrderDto[];
  widgetOrders: WidgetOrderDto[];
  moves: MoveDto[];
};

const TABS: { id: TabId; label: string }[] = [
  { id: "finance", label: "Pénz" },
  { id: "products", label: "Termékek" },
  { id: "orders", label: "Rendelések" },
  { id: "profile", label: "Profil" },
];

const RANGE_OPTS: { months: FinanceMonths; label: string }[] = [
  { months: 3, label: "3 hó" },
  { months: 6, label: "6 hó" },
  { months: 12, label: "12 hó" },
  { months: 24, label: "24 hó" },
];

function toneClass(tone: BehaviorDto["tone"]) {
  if (tone === "ok") return "bg-ok/15 text-ok";
  if (tone === "warn") return "bg-warn/15 text-warn";
  if (tone === "danger") return "bg-danger/15 text-danger";
  return "bg-surface-2 text-text";
}

function deltaText(pct: number | null) {
  if (pct == null) return "—";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function deltaClass(pct: number | null) {
  if (pct == null) return "text-faint";
  if (pct >= 0) return "text-ok font-semibold";
  return "text-danger font-semibold";
}

function formatAddress(a: AddressDto): string {
  return [
    [a.lastname, a.firstname].filter(Boolean).join(" "),
    a.company,
    a.taxNumber ? `Adószám: ${a.taxNumber}` : null,
    [a.postcode, a.city].filter(Boolean).join(" "),
    [a.address1, a.address2].filter(Boolean).join(", "),
    [a.zone, a.country].filter(Boolean).join(", "),
    a.telephone,
  ]
    .filter(Boolean)
    .join("\n");
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-none border-[1.5px] border-line-strong bg-surface p-3.5 ${className}`}
    >
      {children}
    </div>
  );
}

function NameWithHoverImage({
  name,
  href,
  imageUrl,
}: {
  name: string;
  href?: string | null;
  imageUrl?: string | null;
}) {
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(
    null,
  );

  const label = (
    <span className="font-semibold text-text underline-offset-2 group-hover/name:underline">
      {name}
    </span>
  );

  return (
    <>
      <span
        className="group/name inline-flex max-w-full"
        onMouseEnter={(e) => {
          if (!imageUrl) return;
          const r = e.currentTarget.getBoundingClientRect();
          setPreview({ x: r.left, y: r.bottom + 6 });
        }}
        onMouseLeave={() => setPreview(null)}
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="max-w-full truncate"
          >
            {label}
          </a>
        ) : (
          <span className="max-w-full truncate">{label}</span>
        )}
      </span>
      {preview && imageUrl ? (
        <span
          className="pointer-events-none fixed z-50 w-44 overflow-hidden rounded-none border-[1.5px] border-line-strong bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,.18)]"
          style={{ left: preview.x, top: preview.y }}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-40 w-full rounded-none object-contain"
          />
        </span>
      ) : null}
    </>
  );
}

function ChipTrack({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex gap-0.5 overflow-x-auto rounded-none bg-surface-2 p-0.5">
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-7 shrink-0 cursor-pointer rounded-none bg-surface px-2.5 text-[12px] font-semibold text-text shadow-[0_0.5px_1px_rgba(0,0,0,.12)]"
          : "h-7 shrink-0 cursor-pointer rounded-none px-2.5 text-[12px] font-medium text-faint hover:text-text"
      }
    >
      {children}
    </button>
  );
}

export function CustomerDetailView({
  customerInnerId,
}: {
  customerInnerId: number;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [gate, setGate] = useState<PartnerGateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("finance");
  const [financeMonths, setFinanceMonths] = useState<FinanceMonths>(12);
  const [showFinanceExtra, setShowFinanceExtra] = useState(false);

  const [finance, setFinance] = useState<FinanceReport | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductsReport | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<
    Record<string, OrderDetailDto>
  >({});
  const [orderDetailLoading, setOrderDetailLoading] = useState<string | null>(
    null,
  );
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [res, billingRes] = await Promise.all([
        fetch(`/api/merchant/customers/${customerInnerId}`),
        fetch("/api/merchant/billing"),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Betöltés sikertelen");
      setData(json as DetailPayload);
      if (billingRes.ok) {
        const billingJson = await billingRes.json();
        setGate(gateFromBilling(billingJson));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hiba");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [customerInnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFinance = useCallback(
    async (months: FinanceMonths) => {
      setFinanceLoading(true);
      setFinanceError(null);
      try {
        const res = await fetch(
          `/api/merchant/customers/${customerInnerId}/finance?months=${months}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Pénz riport sikertelen");
        setFinance(json.finance as FinanceReport);
      } catch (e) {
        setFinanceError(e instanceof Error ? e.message : "Hiba");
      } finally {
        setFinanceLoading(false);
      }
    },
    [customerInnerId],
  );

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await fetch(
        `/api/merchant/customers/${customerInnerId}/products`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Termékek sikertelen");
      setProducts(json.products as ProductsReport);
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : "Hiba");
    } finally {
      setProductsLoading(false);
    }
  }, [customerInnerId]);

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      setOrderDetailLoading(orderId);
      setOrderDetailError(null);
      try {
        const res = await fetch(
          `/api/merchant/customers/${customerInnerId}/orders/${encodeURIComponent(orderId)}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Rendelés sikertelen");
        setOrderDetails((prev) => ({
          ...prev,
          [orderId]: json.order as OrderDetailDto,
        }));
      } catch (e) {
        setOrderDetailError(e instanceof Error ? e.message : "Hiba");
      } finally {
        setOrderDetailLoading(null);
      }
    },
    [customerInnerId],
  );

  function toggleOrder(orderId: string) {
    if (openOrderId === orderId) {
      setOpenOrderId(null);
      return;
    }
    setOpenOrderId(orderId);
    if (!orderDetails[orderId]) {
      void loadOrderDetail(orderId);
    }
  }

  useEffect(() => {
    if (!data) return;
    if (isPartnerLocked(data.customer.isPartner, data.customer.innerId, gate)) {
      return;
    }
    if (tab === "finance") {
      if (
        !financeLoading &&
        (!finance || finance.rangeMonths !== financeMonths)
      ) {
        void loadFinance(financeMonths);
      }
    }
    if (tab === "products" && !products && !productsLoading) {
      void loadProducts();
    }
  }, [
    data,
    tab,
    financeMonths,
    finance,
    financeLoading,
    loadFinance,
    products,
    productsLoading,
    loadProducts,
    gate,
  ]);

  if (loading && !data) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg text-[13px] text-faint">
        Betöltés…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg px-6">
        <p className="text-[13px] font-medium text-danger">{error}</p>
        <Link href="/vevok" className="text-[13px] font-semibold underline">
          ← Vevők
        </Link>
      </div>
    );
  }

  if (!data) return null;
  const { customer, addresses, stats, behavior, orders, widgetOrders, moves } =
    data;
  const locked = isPartnerLocked(customer.isPartner, customer.innerId, gate);
  if (locked && gate) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-4 py-10">
        <Link href="/vevok" className="text-[12px] font-semibold underline">
          ← Vevők
        </Link>
        <p className="mt-6 text-[18px] font-semibold">Ez a vevő el van rejtve</p>
        <p className="mt-2 text-[13px] text-faint">
          A csomagod {gate.partnerLimit} rendelő vevőt bír. A gyors rendelés a
          boltban ettől még megy. A plusz vevők adatait itt nem mutatjuk.
        </p>
        <div className="mt-5">
          <UpgradeBanner
            used={gate.activePartners}
            limit={gate.partnerLimit}
          />
        </div>
      </div>
    );
  }
  const b = finance?.behavior ?? behavior;
  const productRows = products?.products ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-bg">
      <div className="glass-bar sticky top-0 z-10 px-4 py-2.5 md:px-6">
        <Link href="/vevok" className="text-[12px] font-semibold underline">
          ← Vevők
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold tracking-tight text-text">
              {customer.company || customer.name}
            </h2>
            {customer.company && customer.company !== customer.name ? (
              <p className="text-[12px] text-faint">{customer.name}</p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
              <a href={`mailto:${customer.email}`} className="underline">
                {customer.email}
              </a>
              {customer.telephone ? (
                <a href={`tel:${customer.telephone}`} className="underline">
                  {customer.telephone}
                </a>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className={`inline-flex rounded-none px-2 py-0.5 text-[11px] font-semibold ${toneClass(b.tone)}`}>
                {b.label}
              </span>
              <span className="inline-flex rounded-none bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text">
                {customer.groupName || "Nincs csoport"}
              </span>
              <span
                className={
                  customer.isPartner
                    ? "inline-flex rounded-none bg-ok/15 px-2 py-0.5 text-[11px] font-semibold text-ok"
                    : "inline-flex rounded-none bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-text"
                }
              >
                {customer.isPartner ? "Partner" : "Új / alap"}
              </span>
              <span className="inline-flex rounded-none bg-surface-2 px-2 py-0.5 text-[11px] text-faint">
                #{customer.innerId}
              </span>
            </div>
          </div>
        </div>
        {b.decisionLine ? (
          <p className="mt-2 text-[12px] leading-snug text-faint">
            {b.decisionLine}
          </p>
        ) : null}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-3 md:px-6">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            { label: "Összesen", value: stats.totalSpentFormatted },
            { label: "30 nap", value: stats.totalSpent30dFormatted },
            {
              label: "Utolsó óta",
              value:
                b.daysSinceLastOrder != null
                  ? `${b.daysSinceLastOrder} nap`
                  : "—",
            },
            {
              label: "3 hó trend",
              value: deltaText(b.trend3mPercent),
              cls: deltaClass(b.trend3mPercent),
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-none border-[1.5px] border-line-strong bg-surface px-2.5 py-2"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                {k.label}
              </p>
              <p
                className={`mt-0.5 text-[14px] font-semibold tabular-nums ${k.cls ?? "text-text"}`}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <ChipTrack>
            {TABS.map((t) => (
              <Chip
                key={t.id}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Chip>
            ))}
          </ChipTrack>
        </div>

        <div className="mt-3 pb-10">
          {tab === "finance" ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ChipTrack>
                  {RANGE_OPTS.map((r) => (
                    <Chip
                      key={r.months}
                      active={financeMonths === r.months}
                      onClick={() => setFinanceMonths(r.months)}
                    >
                      {r.label}
                    </Chip>
                  ))}
                </ChipTrack>
                <button
                  type="button"
                  disabled={financeLoading}
                  onClick={() => void loadFinance(financeMonths)}
                  className="text-[12px] font-semibold underline disabled:opacity-40"
                >
                  {financeLoading ? "…" : "Frissít"}
                </button>
              </div>

              {financeError ? (
                <p className="text-[12px] text-danger">{financeError}</p>
              ) : null}
              {financeLoading && !finance ? (
                <p className="text-[12px] text-faint">Pénz riport…</p>
              ) : null}

              {finance ? (
                <>
                  <Surface>
                    <p className="text-[12px] font-medium leading-snug text-text">
                      {finance.narrative}
                    </p>
                    <p className="mt-1 text-[11px] text-faint">
                      {finance.rangeLabel} · minta {finance.sampleOrderCount}{" "}
                      rendelés
                    </p>
                  </Surface>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[
                      {
                        label: "Költés",
                        value: finance.totals.spentFormatted,
                      },
                      {
                        label: "Áru (becslés)",
                        value: finance.totals.goodsEstimateFormatted,
                      },
                      {
                        label: "Szállítás",
                        value: `${finance.totals.shippingFormatted}${
                          finance.totals.shippingPercent != null
                            ? ` · ${finance.totals.shippingPercent}%`
                            : ""
                        }`,
                      },
                      {
                        label: "Kedvezmény",
                        value: `${finance.totals.discountFormatted}${
                          finance.totals.discountPercent != null
                            ? ` · ${finance.totals.discountPercent}%`
                            : ""
                        }`,
                      },
                    ].map((k) => (
                      <div
                        key={k.label}
                        className="rounded-none border-[1.5px] border-line-strong bg-surface px-2.5 py-2"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                          {k.label}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-text">
                          {k.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Surface>
                    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                      <h3 className="text-[13px] font-semibold text-text">
                        Havi bontás
                      </h3>
                      <p className="text-[11px] text-faint">
                        Δ = változás az előző hónaphoz
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
                        <thead>
                          <tr className="border-b border-line-strong text-[10px] font-semibold uppercase tracking-wide text-faint">
                            <th className="py-1.5 pr-2">Hónap</th>
                            <th className="py-1.5 pr-2 text-right">Db</th>
                            <th className="py-1.5 pr-2 text-right">Költés</th>
                            <th className="py-1.5 pr-2 text-right">Δ</th>
                            <th className="py-1.5 pr-2 text-right">Száll.</th>
                            <th className="py-1.5 pr-2 text-right">Kedv.</th>
                            <th className="py-1.5">Megj.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finance.byMonth.map((m) => (
                            <tr
                              key={m.key}
                              className="border-b border-line"
                            >
                              <td className="py-1.5 pr-2 font-medium text-text">
                                {m.label}
                              </td>
                              <td className="py-1.5 pr-2 text-right tabular-nums text-faint">
                                {m.orderCount}
                              </td>
                              <td className="py-1.5 pr-2 text-right font-semibold tabular-nums text-text">
                                {m.spentFormatted}
                              </td>
                              <td
                                className={`py-1.5 pr-2 text-right tabular-nums ${deltaClass(m.deltaPercent)}`}
                              >
                                {deltaText(m.deltaPercent)}
                              </td>
                              <td className="py-1.5 pr-2 text-right tabular-nums text-faint">
                                {m.shippingFormatted}
                              </td>
                              <td className="py-1.5 pr-2 text-right tabular-nums text-faint">
                                {m.discountFormatted}
                              </td>
                              <td className="py-1.5 text-faint">
                                {m.note || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Surface>
                      <p className="text-[11px] font-semibold uppercase text-faint">
                        Ez a hónap
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-text">
                        {finance.thisMonth?.spentFormatted} ·{" "}
                        {finance.thisMonth?.orderCount} rendelés
                      </p>
                      <p className="text-[12px] text-faint">
                        Előző: {finance.prevMonth?.spentFormatted} · Δ{" "}
                        <span className={deltaClass(finance.monthDeltaPercent)}>
                          {deltaText(finance.monthDeltaPercent)}
                        </span>
                      </p>
                    </Surface>
                    <Surface>
                      <p className="text-[11px] font-semibold uppercase text-faint">
                        Éves
                      </p>
                      {finance.thisYear ? (
                        <p className="mt-1 text-[13px] font-semibold text-text">
                          {finance.thisYear.year}:{" "}
                          {finance.thisYear.spentFormatted}
                        </p>
                      ) : null}
                      {finance.prevYear ? (
                        <p className="text-[12px] text-faint">
                          {finance.prevYear.year}:{" "}
                          {finance.prevYear.spentFormatted}
                        </p>
                      ) : null}
                    </Surface>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFinanceExtra((v) => !v)}
                    className="text-[12px] font-semibold underline"
                  >
                    {showFinanceExtra
                      ? "Részletek elrejtése"
                      : "ÁFA / fiz. díj / ingy. szállítás"}
                  </button>
                  {showFinanceExtra ? (
                    <Surface>
                      <dl className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
                        <div>
                          <dt className="text-faint">ÁFA Σ</dt>
                          <dd className="font-semibold">
                            {finance.totals.taxFormatted}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-faint">Fiz. díj Σ</dt>
                          <dd className="font-semibold">
                            {finance.totals.paymentFeesFormatted}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-faint">Ingy. szállítás</dt>
                          <dd className="font-semibold">
                            {finance.totals.freeShippingRate != null
                              ? `${finance.totals.freeShippingRate}%`
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </Surface>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "products" ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-faint">
                  {products?.legend ||
                    "Bolti rendelésekből. Tipikus db = medián mennyiség. Képre a név fölé húzva."}
                </p>
                <button
                  type="button"
                  disabled={productsLoading}
                  onClick={() => void loadProducts()}
                  className="text-[12px] font-semibold underline disabled:opacity-40"
                >
                  {productsLoading ? "…" : "Frissít"}
                </button>
              </div>
              {productsError ? (
                <p className="text-[12px] text-danger">{productsError}</p>
              ) : null}
              {productsLoading && !products ? (
                <p className="text-[12px] text-faint">
                  Termékek elemzése (pár mp)…
                </p>
              ) : null}

              {products ? (
                <Surface className="!p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-line-strong bg-surface-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
                          <th className="px-3 py-2">Termék</th>
                          <th className="px-2 py-2">SKU</th>
                          <th className="px-2 py-2">Gyártói cikkszám</th>
                          <th className="px-2 py-2 text-right">Nettó</th>
                          <th className="px-2 py-2 text-right">Bruttó</th>
                          <th className="px-2 py-2 text-right">Össz db</th>
                          <th className="px-2 py-2 text-right">Rend.</th>
                          <th className="px-2 py-2">Utoljára</th>
                          <th className="px-3 py-2 text-right">Tipikus db</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-3 py-6 text-center text-faint"
                            >
                              Nincs tétel a mintában.
                            </td>
                          </tr>
                        ) : (
                          productRows.map((p) => (
                            <tr
                              key={p.sku}
                              className="border-b border-line align-middle"
                            >
                              <td className="px-3 py-2.5">
                                <NameWithHoverImage
                                  name={p.name || p.sku}
                                  href={p.productUrl}
                                  imageUrl={p.imageUrl}
                                />
                              </td>
                              <td className="px-2 py-2.5 font-mono text-[12px] font-semibold text-text">
                                {p.sku || "—"}
                              </td>
                              <td className="px-2 py-2.5 font-mono text-[12px] text-text">
                                {p.modelNumber || "—"}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums">
                                {p.lastPriceNetFormatted || "—"}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums">
                                {p.lastPriceGrossFormatted || "—"}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums font-semibold">
                                {p.totalQty}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums text-faint">
                                {p.orderCount}
                              </td>
                              <td className="px-2 py-2.5 text-faint">
                                {p.lastOrderedLabel}
                                <span className="block text-[10px]">
                                  {p.daysSince} napja
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                {p.suggestedQty != null
                                  ? `${p.suggestedQty} db`
                                  : "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Surface>
              ) : null}
            </div>
          ) : null}

          {tab === "orders" ? (
            <div className="space-y-2">
              {orderDetailError ? (
                <p className="text-[12px] text-danger">{orderDetailError}</p>
              ) : null}
              <div className="overflow-x-auto border-[1.5px] border-line-strong bg-surface">
                <table className="w-full min-w-[520px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-line-strong bg-surface-2 text-[10px] font-semibold uppercase text-faint">
                      <th className="w-8 px-2 py-2" />
                      <th className="px-2 py-2 text-left">Dátum</th>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">Státusz</th>
                      <th className="px-2 py-2 text-right">Szállítás</th>
                      <th className="px-3 py-2 text-right">Összeg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-faint"
                        >
                          Nincs rendelés.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => {
                        const open = openOrderId === o.id;
                        const detail = orderDetails[o.id];
                        const loading = orderDetailLoading === o.id;
                        return (
                          <Fragment key={o.id}>
                            <tr
                              className="cursor-pointer border-b border-line hover:bg-surface-2/60"
                              onClick={() => toggleOrder(o.id)}
                            >
                              <td className="px-2 py-2 text-center text-faint">
                                {open ? "▾" : "▸"}
                              </td>
                              <td className="px-2 py-2 font-medium">
                                {o.dateLabel}
                              </td>
                              <td className="px-2 py-2 text-faint">
                                {o.innerId}
                              </td>
                              <td className="px-2 py-2">
                                <span className="text-[11px]">{o.status}</span>
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-faint">
                                {o.shippingGross != null
                                  ? `${o.shippingGross.toLocaleString("hu-HU")} Ft`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                {o.totalFormatted}
                              </td>
                            </tr>
                            {open ? (
                              <tr className="border-b border-line">
                                <td colSpan={6} className="bg-surface-2/50 px-2 py-0">
                                  {loading && !detail ? (
                                    <p className="px-2 py-3 text-[12px] text-faint">
                                      Tételek…
                                    </p>
                                  ) : detail ? (
                                    <table className="w-full min-w-[640px] border-collapse text-[12px]">
                                      <thead>
                                        <tr className="text-[10px] font-semibold uppercase text-faint">
                                          <th className="px-2 py-2 text-left">
                                            Termék
                                          </th>
                                          <th className="px-2 py-2 text-left">
                                            SKU
                                          </th>
                                          <th className="px-2 py-2 text-left">
                                            Gyártói cikkszám
                                          </th>
                                          <th className="px-2 py-2 text-right">
                                            Db
                                          </th>
                                          <th className="px-2 py-2 text-right">
                                            Nettó
                                          </th>
                                          <th className="px-2 py-2 text-right">
                                            Bruttó
                                          </th>
                                          <th className="px-2 py-2 text-right">
                                            Sor
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.lines.length === 0 ? (
                                          <tr>
                                            <td
                                              colSpan={7}
                                              className="px-2 py-3 text-faint"
                                            >
                                              Nincs tétel.
                                            </td>
                                          </tr>
                                        ) : (
                                          detail.lines.map((l, i) => (
                                            <tr
                                              key={`${l.sku}-${i}`}
                                              className="border-t border-line"
                                            >
                                              <td className="px-2 py-1.5 font-medium">
                                                {l.productUrl ? (
                                                  <a
                                                    href={l.productUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="underline"
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    {l.name || l.sku || "—"}
                                                  </a>
                                                ) : (
                                                  l.name || l.sku || "—"
                                                )}
                                              </td>
                                              <td className="px-2 py-1.5 font-mono text-[11px] font-semibold">
                                                {l.sku || "—"}
                                              </td>
                                              <td className="px-2 py-1.5 font-mono text-[11px]">
                                                {l.modelNumber || "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                                                {l.quantity}
                                              </td>
                                              <td className="px-2 py-1.5 text-right tabular-nums">
                                                {l.priceNetFormatted || "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right tabular-nums">
                                                {l.priceGrossFormatted || "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                                                {l.lineTotalGrossFormatted ||
                                                  "—"}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                        {detail.paymentMethodName ||
                                        detail.shippingMethodName ||
                                        detail.discountFormatted ? (
                                          <tr className="border-t border-line">
                                            <td
                                              colSpan={7}
                                              className="px-2 py-2 text-[11px] text-faint"
                                            >
                                              {[
                                                detail.shippingMethodName
                                                  ? `Szállítás: ${detail.shippingMethodName}`
                                                  : null,
                                                detail.paymentMethodName
                                                  ? `Fizetés: ${detail.paymentMethodName}`
                                                  : null,
                                                detail.discountFormatted
                                                  ? `Kedvezmény: ${detail.discountFormatted}`
                                                  : null,
                                              ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                            </td>
                                          </tr>
                                        ) : null}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="px-2 py-3 text-[12px] text-faint">
                                      Nem sikerült betölteni.
                                    </p>
                                  )}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="grid gap-2 md:grid-cols-2">
              <Surface>
                <h3 className="text-[13px] font-semibold">Adatok</h3>
                <dl className="mt-2 space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Regisztráció</dt>
                    <dd>
                      {customer.dateCreated
                        ? relativeTime(customer.dateCreated)
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Adószám</dt>
                    <dd>{customer.taxNumber || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-faint">Cég</dt>
                    <dd>{customer.company || "—"}</dd>
                  </div>
                </dl>
                <h3 className="mt-4 text-[13px] font-semibold">Címek</h3>
                {addresses.length === 0 ? (
                  <p className="mt-1 text-[12px] text-faint">Nincs cím.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {addresses.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-none bg-surface-2 px-2.5 py-2 text-[12px] whitespace-pre-line"
                      >
                        {formatAddress(a)}
                      </li>
                    ))}
                  </ul>
                )}
              </Surface>
              <div className="space-y-2">
                <Surface>
                  <h3 className="text-[13px] font-semibold">Átrakások</h3>
                  {moves.length === 0 ? (
                    <p className="mt-1 text-[12px] text-faint">
                      Nincs rögzítve. Átrakás a Vevők listán.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[12px]">
                      {moves.map((m) => (
                        <li key={m.id}>
                          <span className="font-medium">
                            {m.fromGroupName || "—"} → {m.toGroupName || "—"}
                          </span>
                          <span className="ml-1 text-faint">
                            {relativeTime(m.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Surface>
                <Surface>
                  <h3 className="text-[13px] font-semibold">Widget</h3>
                  {widgetOrders.length === 0 ? (
                    <p className="mt-1 text-[12px] text-faint">
                      Nincs widget fact.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-[12px]">
                      {widgetOrders.map((w) => (
                        <li
                          key={w.id}
                          className="flex justify-between gap-2"
                        >
                          <span className="text-faint">
                            {relativeTime(w.createdAt)} · {w.lineCount} tétel
                          </span>
                          <span className="font-semibold">
                            {w.grossTotal != null
                              ? `${Math.round(w.grossTotal).toLocaleString("hu-HU")} Ft`
                              : w.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Surface>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
