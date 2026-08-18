"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CreateOrgDrawer } from "@/components/platform/CreateOrgDrawer";
import { PLAN_DEFAULTS } from "@/lib/billing/plans";
import { relativeTime } from "@/lib/format";
import { fleetSummary, type OrgListRow } from "@/lib/orgs/types";
import { healthLabel, type HealthLevel } from "@/lib/orgs/health";

const STATUS_CLASS: Record<string, string> = {
  active: "border border-ok text-ok",
  trial: "border border-line-strong text-text",
  suspended: "border border-danger text-danger",
  lejárt: "border border-danger text-danger",
};

const HEALTH_CLASS: Record<HealthLevel, string> = {
  ok: "border border-ok text-ok",
  warn: "border border-warn text-warn",
  crit: "border border-danger text-danger",
};

type Props = {
  initialRows: OrgListRow[];
};

export function AdminTenantsView({ initialRows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<{
    url: string;
    email: string;
    orgId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const plan = searchParams.get("plan") ?? "";
  const health = searchParams.get("health") ?? "";
  const catalog = searchParams.get("catalog") ?? "";
  const widget = searchParams.get("widget") ?? "";
  const flag = searchParams.get("flag") ?? "";

  const summary = useMemo(() => fleetSummary(initialRows), [initialRows]);

  const rows = useMemo(() => {
    return initialRows.filter((r) => {
      if (health === "ok" || health === "warn" || health === "crit") {
        if (r.health !== health) return false;
      }
      if (catalog === "ready" && r.catalog_status !== "ready") return false;
      if (
        catalog === "syncing" &&
        r.catalog_status !== "syncing" &&
        r.catalog_status !== "pending"
      ) {
        return false;
      }
      if (
        catalog === "error" &&
        r.catalog_status !== "error" &&
        r.catalog_status !== "blocked_limit"
      ) {
        return false;
      }
      if (widget === "on" && !r.widget_enabled) return false;
      if (widget === "off" && r.widget_enabled) return false;
      if (
        flag === "trialSoon" &&
        !(r.trialActive && r.trialDaysLeft != null && r.trialDaysLeft <= 7)
      ) {
        return false;
      }
      if (flag === "overCap" && !r.overCap) return false;
      if (flag === "erpQualified" && !r.erpQualified) return false;
      return true;
    });
  }, [initialRows, health, catalog, widget, flag]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.push(`/admin?${next.toString()}`);
    });
  }

  function toggleChip(key: string, value: string) {
    setFilter(key, searchParams.get(key) === value ? "" : value);
  }

  async function copyLink() {
    if (!inviteBanner) return;
    try {
      await navigator.clipboard.writeText(inviteBanner.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] text-faint">
          {rows.length} / {initialRows.length} szervezet{pending ? " · …" : ""}
        </p>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="tn-btn tn-btn-primary"
        >
          Új szervezet
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["health", "crit", "Ég", summary.crit],
            ["health", "warn", "Figyelj", summary.warn],
            ["flag", "trialSoon", "Próba ≤7 nap", summary.trialSoon],
            ["flag", "overCap", "Teli vevőcsomag", summary.overCap],
            ["flag", "erpQualified", "ERP jelölt", summary.erpQualified],
          ] as const
        ).map(([key, value, label, n]) => {
          const on = searchParams.get(key) === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleChip(key, value)}
              className={
                on
                  ? "border-2 border-text bg-surface-2 px-3 py-3 text-left"
                  : "border border-line-strong bg-surface px-3 py-3 text-left"
              }
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                {label}
              </p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">{n}</p>
            </button>
          );
        })}
      </div>

      {inviteBanner ? (
        <div className="mb-6 border border-line-strong bg-surface-2 px-5 py-4">
          <p className="text-[14px] font-semibold">
            Meghívó kész → {inviteBanner.email}
          </p>
          <p className="mt-2 break-all font-mono text-[12px] text-faint">
            {inviteBanner.url}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="tn-btn tn-btn-primary !h-8 !px-3 text-[12px]"
            >
              {copied ? "Másolva" : "Link másolása"}
            </button>
            <Link
              href={`/admin/orgs/${inviteBanner.orgId}`}
              className="tn-btn tn-btn-ghost !h-8 !px-3 text-[12px]"
            >
              Megnyitás
            </Link>
            <button
              type="button"
              onClick={() => setInviteBanner(null)}
              className="tn-btn tn-btn-ghost !h-8 !px-3 text-[12px]"
            >
              Elrejt
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Név, shop, email…"
          defaultValue={q}
          key={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setFilter("q", (e.target as HTMLInputElement).value.trim());
            }
          }}
          className="tn-input min-w-[160px] flex-1 sm:max-w-[280px]"
        />
        <select
          className="tn-input !w-auto cursor-pointer"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Státusz"
        >
          <option value="">Státusz</option>
          <option value="active">éles</option>
          <option value="trial">próba</option>
          <option value="suspended">felfüggesztve</option>
        </select>
        <select
          className="tn-input !w-auto cursor-pointer"
          value={plan}
          onChange={(e) => setFilter("plan", e.target.value)}
          aria-label="Csomag"
        >
          <option value="">Csomag</option>
          <option value="start">Start</option>
          <option value="plus">Plus</option>
          <option value="pro">Pro</option>
        </select>
        <select
          className="tn-input !w-auto cursor-pointer"
          value={catalog}
          onChange={(e) => setFilter("catalog", e.target.value)}
          aria-label="Termékek"
        >
          <option value="">Termékek</option>
          <option value="ready">kész</option>
          <option value="syncing">másolódik</option>
          <option value="error">hiba / teli</option>
        </select>
        <select
          className="tn-input !w-auto cursor-pointer"
          value={widget}
          onChange={(e) => setFilter("widget", e.target.value)}
          aria-label="Gyors rendelés"
        >
          <option value="">Gyors rendelés</option>
          <option value="on">be</option>
          <option value="off">ki</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="border border-line-strong px-6 py-14 text-center">
          <p className="text-[18px] font-semibold tracking-tight">
            Nincs ilyen szervezet
          </p>
          <p className="mt-2 text-[13px] text-faint">
            {initialRows.length === 0
              ? "Hozz létre egyet meghívóval."
              : "A szűrő nem talál semmit."}
          </p>
          {initialRows.length === 0 ? (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="tn-btn tn-btn-primary mt-6"
            >
              Új szervezet
            </button>
          ) : null}
        </div>
      ) : (
        <div className="w-full overflow-x-auto border border-line-strong">
          <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                {[
                  "Szervezet",
                  "Állapot",
                  "Csomag",
                  "Vevők / hó",
                  "Termékek",
                  "Gyors rendelés",
                  "Aktivitás",
                  "",
                ].map((h) => (
                  <th
                    key={h || "actions"}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const statusLabel = row.trialExpired
                  ? "lejárt"
                  : row.status === "trial"
                    ? "próba"
                    : row.status === "suspended"
                      ? "felfüggesztve"
                      : "éles";
                const statusClass =
                  row.shop_status === "needs_reauth"
                    ? "border border-warn text-warn"
                    : STATUS_CLASS[row.trialExpired ? "lejárt" : row.status] ??
                      STATUS_CLASS.trial;
                const fill =
                  row.partner_limit <= 0
                    ? 0
                    : Math.min(
                        100,
                        Math.round((row.partner_used / row.partner_limit) * 100),
                      );
                return (
                  <tr
                    key={row.id}
                    className="border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orgs/${row.id}`}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-[12px] text-faint">
                        {row.shop_name ?? "—"}
                        {row.owner_email ? ` · ${row.owner_email}` : ""}
                        {row.invite_status === "pending"
                          ? row.invite_expired
                            ? " · meghívó lejárt"
                            : " · meghívó"
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-6 items-center px-2 text-[11px] font-semibold ${HEALTH_CLASS[row.health]}`}
                        title={row.healthReason}
                      >
                        {healthLabel(row.health)}
                      </span>
                      <p className="mt-1 max-w-[220px] text-[11px] text-faint">
                        {row.healthReason}
                      </p>
                      <span
                        className={`mt-1 inline-flex h-5 items-center px-1.5 text-[10px] font-semibold ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {PLAN_DEFAULTS[row.plan].label}
                      </p>
                      {row.trialActive && row.trialDaysLeft != null ? (
                        <p className="text-[12px] text-faint">
                          {PLAN_DEFAULTS[row.plan].label} · próba {row.trialDaysLeft}{" "}
                          nap
                        </p>
                      ) : null}
                      {row.erpQualified ? (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ok">
                          ERP jelölt
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular-nums font-medium">
                        {row.partner_used} / {row.partner_limit}
                      </p>
                      <div className="mt-1 h-1.5 w-24 border border-line-strong bg-surface-2">
                        <div
                          className={
                            row.overCap || row.warn80
                              ? "h-full bg-warn"
                              : "h-full bg-text"
                          }
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular-nums font-medium">
                        {row.product_count.toLocaleString("hu-HU")}
                      </p>
                      <p className="text-[12px] text-faint">{row.catalog_label}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.widget_enabled
                            ? "font-semibold text-ok"
                            : "text-faint"
                        }
                      >
                        {row.widget_enabled ? "Be" : "Ki"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-faint">
                      {row.last_activity_at
                        ? relativeTime(row.last_activity_at)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orgs/${row.id}`}
                        className="text-[12px] font-semibold underline underline-offset-2"
                      >
                        Megnyitás
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateOrgDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={(r) =>
          setInviteBanner({
            url: r.inviteUrl,
            email: r.ownerEmail,
            orgId: r.organizationId,
          })
        }
      />
    </>
  );
}
