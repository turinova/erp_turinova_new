"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INK = "#0f172a";
const MUTED = "#64748b";
const PARTNER = "#0b6bcb";
const NEWCOMER = "#64748b";
const GUEST = "#94a3b8";
const OTHER = "#cbd5e1";
const WIDGET = "#0b6bcb";
const STORE = "#e2e8f0";

type TrendPoint = {
  key: string;
  label: string;
  spent: number;
  partnerSpent: number;
  newcomerSpent: number;
  guestSpent: number;
  otherSpent: number;
  orderCount: number;
  spentFormatted: string;
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export function RevenueAreaChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend.length) {
    return (
      <p className="py-10 text-center text-[12px] text-faint">
        Nincs adat a trendhez ebben a tartományban.
      </p>
    );
  }
  const data = trend.map((t) => ({
    ...t,
    month: t.label.replace(/\s*20\d{2}/, "").trim() || t.label,
  }));

  return (
    <div className="w-full">
      <div className="h-[200px] w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id="pgPartnerFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PARTNER} stopOpacity={0.35} />
                <stop offset="100%" stopColor={PARTNER} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: MUTED }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 10, fill: MUTED }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                border: "1.5px solid #e2e8f0",
                borderRadius: 0,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const labels: Record<string, string> = {
                  partnerSpent: "Partner",
                  newcomerSpent: "Új",
                  guestSpent: "Vendég",
                  otherSpent: "Egyéb",
                };
                const n = typeof value === "number" ? value : Number(value);
                return [
                  `${Number.isFinite(n) ? n.toLocaleString("hu-HU") : "—"} Ft`,
                  labels[String(name)] || String(name),
                ];
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as TrendPoint | undefined;
                return row
                  ? `${row.label} · ${row.orderCount} rendelés · ${row.spentFormatted}`
                  : "";
              }}
            />
            <Area
              type="monotone"
              dataKey="otherSpent"
              stackId="1"
              stroke={OTHER}
              fill={OTHER}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="guestSpent"
              stackId="1"
              stroke={GUEST}
              fill={GUEST}
              fillOpacity={0.8}
            />
            <Area
              type="monotone"
              dataKey="newcomerSpent"
              stackId="1"
              stroke={NEWCOMER}
              fill={NEWCOMER}
              fillOpacity={0.75}
            />
            <Area
              type="monotone"
              dataKey="partnerSpent"
              stackId="1"
              stroke={PARTNER}
              fill="url(#pgPartnerFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-faint">
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-2.5 w-2.5 shrink-0"
            style={{ background: PARTNER }}
          />
          Partner
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-2.5 w-2.5 shrink-0"
            style={{ background: NEWCOMER }}
          />
          Új
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-2.5 w-2.5 shrink-0"
            style={{ background: GUEST }}
          />
          Vendég
        </span>
      </div>
    </div>
  );
}

export function ChannelDonut({
  widgetPercent,
  storePercent,
  widgetLabel,
  storeLabel,
}: {
  widgetPercent: number | null;
  storePercent: number | null;
  widgetLabel: string;
  storeLabel: string;
}) {
  const w = widgetPercent ?? 0;
  const s = storePercent ?? 0;
  if (w <= 0 && s <= 0) {
    return (
      <p className="py-10 text-center text-[12px] text-faint">Nincs csatorna-adat.</p>
    );
  }
  const data = [
    { name: "Widget", value: w, fill: WIDGET },
    { name: "Bolt", value: s, fill: STORE },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-4">
      <div className="h-[140px] w-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value}%`, ""]}
              contentStyle={{
                border: "1.5px solid #e2e8f0",
                borderRadius: 0,
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 space-y-2 text-[12px]">
        <div>
          <p className="font-semibold text-text">
            Widget {widgetPercent != null ? `${widgetPercent}%` : "—"}
          </p>
          <p className="text-[11px] text-faint tabular-nums">{widgetLabel}</p>
        </div>
        <div>
          <p className="font-semibold text-faint">
            Bolt {storePercent != null ? `${storePercent}%` : "—"}
          </p>
          <p className="text-[11px] text-faint tabular-nums">{storeLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function GroupBarList({
  groups,
}: {
  groups: { name: string; spent: number; spentFormatted: string }[];
}) {
  const top = groups.slice(0, 8);
  if (!top.length) {
    return (
      <p className="py-8 text-center text-[12px] text-faint">Nincs csoport-adat.</p>
    );
  }
  const max = Math.max(...top.map((g) => g.spent), 1);
  return (
    <div className="space-y-2.5">
      {top.map((g) => (
        <div key={g.name}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="truncate font-medium text-text">{g.name}</span>
            <span className="shrink-0 tabular-nums font-semibold text-text">
              {g.spentFormatted}
            </span>
          </div>
          <div className="h-2 w-full bg-surface-2">
            <div
              className="h-full bg-text transition-[width] duration-300"
              style={{ width: `${Math.max(2, Math.round((g.spent / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HealthTracker({
  active,
  sleeping,
  total,
}: {
  active: number;
  sleeping: number;
  total: number;
}) {
  const t = Math.max(total, active + sleeping, 1);
  const aPct = Math.round((active / t) * 100);
  const sPct = Math.round((sleeping / t) * 100);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden border border-line-strong">
        <div className="bg-ok" style={{ width: `${aPct}%` }} title={`Aktív ${active}`} />
        <div
          className="bg-warn"
          style={{ width: `${sPct}%` }}
          title={`Alvó ${sleeping}`}
        />
        <div
          className="bg-surface-2"
          style={{ width: `${Math.max(0, 100 - aPct - sPct)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
        <span>
          <span className="font-semibold text-text">{active}</span>{" "}
          <span className="text-faint">aktív</span>
        </span>
        <span>
          <span className="font-semibold text-warn">{sleeping}</span>{" "}
          <span className="text-faint">alvó</span>
        </span>
        <span className="text-faint">összesen {total} partner</span>
      </div>
    </div>
  );
}

export function SkuBarChart({
  products,
}: {
  products: {
    name: string | null;
    quantity: number;
    lineRevenue: number;
  }[];
}) {
  const data = products.slice(0, 8).map((p) => ({
    name: (p.name || "SKU").slice(0, 18),
    qty: p.quantity,
    revenue: p.lineRevenue,
  }));
  if (!data.length) {
    return (
      <p className="py-8 text-center text-[12px] text-faint">Nincs termék-adat.</p>
    );
  }
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 10, fill: MUTED }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? value.toLocaleString("hu-HU") : value,
              name === "revenue" ? "Bevétel (Ft)" : "Db",
            ]}
            contentStyle={{
              border: "1.5px solid #e2e8f0",
              borderRadius: 0,
              fontSize: 12,
            }}
          />
          <Bar dataKey="revenue" fill={INK} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
