"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CreateOrgDrawer } from "@/components/platform/CreateOrgDrawer";
import {
  BASE_PRICE_HUF,
  WHITE_LABEL_PRICE_HUF,
  formatPlanPrice,
  hasWhiteLabel,
  type PlanId,
} from "@/lib/billing/plans";
import { relativeTime } from "@/lib/format";
import { fleetSummary, sortFleet, type OrgListRow } from "@/lib/orgs/types";

function adminPlanLabel(plan: PlanId, trialActive: boolean): string {
  if (trialActive) return "Próba";
  if (hasWhiteLabel(plan)) {
    return `Felirat nélkül · ${formatPlanPrice(WHITE_LABEL_PRICE_HUF)}`;
  }
  return `Alap · ${formatPlanPrice(BASE_PRICE_HUF)}`;
}

function rowStatusLine(row: OrgListRow): { label: string; tone: "ok" | "warn" | "crit" | "muted" } {
  if (row.health === "crit") {
    return { label: row.healthReason || "Baj", tone: "crit" };
  }
  if (row.status === "suspended") {
    return { label: "Felfüggesztve", tone: "crit" };
  }
  if (row.trialExpired) {
    return { label: "Lejárt próba", tone: "crit" };
  }
  if (row.health === "warn") {
    return { label: row.healthReason || "Figyelem", tone: "warn" };
  }
  if (row.trialActive && row.trialDaysLeft != null) {
    return {
      label: `Próba · ${row.trialDaysLeft} nap`,
      tone: row.trialDaysLeft <= 7 ? "warn" : "muted",
    };
  }
  if (row.trialActive) return { label: "Próba", tone: "muted" };
  return { label: adminPlanLabel(row.plan, false), tone: "ok" };
}

const TONE_CLASS = {
  ok: "border border-ok text-ok",
  warn: "border border-warn text-warn",
  crit: "border border-danger text-danger",
  muted: "border border-line-strong text-text",
} as const;

type Props = {
  initialRows: OrgListRow[];
};

export function AdminTenantsView({ initialRows }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
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
  const troubleCount = summary.crit + summary.warn;

  const rows = useMemo(() => {
    const filtered = initialRows.filter((r) => {
      if (health === "trouble") {
        if (r.health !== "crit" && r.health !== "warn") return false;
      } else if (health === "ok" || health === "warn" || health === "crit") {
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
      if (plan === "plus" || plan === "pro") {
        if (!hasWhiteLabel(r.plan) || r.trialActive) return false;
      }
      if (plan === "start") {
        if (hasWhiteLabel(r.plan) || r.trialActive) return false;
      }
      return true;
    });
    return sortFleet(filtered);
  }, [initialRows, health, catalog, widget, flag, plan]);

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

  const extraFilterOn = Boolean(catalog || widget || flag === "overCap" || flag === "erpQualified");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-text">
            {troubleCount > 0
              ? `${troubleCount} tenant vár intézkedést`
              : "Minden rendben"}
          </p>
          <p className="mt-0.5 text-[12px] text-faint">
            {rows.length} megjelenítve
            {pending ? " · …" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="tn-btn tn-btn-primary"
        >
          Új szervezet
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            ["health", "trouble", "Bajban", troubleCount],
            ["flag", "trialSoon", "Próba ≤7 nap", summary.trialSoon],
            ["health", "ok", "Rendben", summary.ok],
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
          placeholder="Keresés: név, shop, email…"
          defaultValue={q}
          key={q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setFilter("q", (e.target as HTMLInputElement).value.trim());
            }
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== q) setFilter("q", v);
          }}
          className="tn-input min-w-[180px] flex-1 sm:max-w-[320px]"
          id="admin-tenant-search"
        />
        <select
          className="tn-select cursor-pointer"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Státusz"
        >
          <option value="">Státusz</option>
          <option value="active">éles</option>
          <option value="trial">próba</option>
          <option value="suspended">felfüggesztve</option>
        </select>
        <button
          type="button"
          onClick={() => setMoreFilters((v) => !v)}
          className="tn-btn tn-btn-ghost !h-9 text-[12px]"
        >
          {moreFilters ? "Kevesebb szűrő" : "Több szűrő"}
          {extraFilterOn && !moreFilters ? " ·" : ""}
        </button>
      </div>

      {moreFilters ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            className="tn-select cursor-pointer"
            value={plan === "pro" ? "plus" : plan}
            onChange={(e) => setFilter("plan", e.target.value)}
            aria-label="Csomag"
          >
            <option value="">Csomag</option>
            <option value="start">Alap (felirat van)</option>
            <option value="plus">Felirat nélkül</option>
          </select>
          <select
            className="tn-select cursor-pointer"
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
            className="tn-select cursor-pointer"
            value={widget}
            onChange={(e) => setFilter("widget", e.target.value)}
            aria-label="Gyors rendelés"
          >
            <option value="">Gyors rendelés</option>
            <option value="on">be</option>
            <option value="off">ki</option>
          </select>
          <select
            className="tn-select cursor-pointer"
            value={flag === "overCap" || flag === "erpQualified" ? flag : ""}
            onChange={(e) => setFilter("flag", e.target.value)}
            aria-label="Egyéb"
          >
            <option value="">Egyéb</option>
            <option value="overCap">Soft limit tele</option>
            <option value="erpQualified">ERP jelölt</option>
          </select>
        </div>
      ) : null}

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
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line-strong bg-surface-2">
                {["Szervezet", "Állapot", "Termékek", "Widget"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const st = rowStatusLine(row);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                    onClick={() => router.push(`/admin/orgs/${row.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text">{row.name}</p>
                      <p className="text-[12px] text-faint">
                        {row.shop_name ?? "—"}
                        {row.owner_email ? ` · ${row.owner_email}` : ""}
                        {row.invite_status === "pending"
                          ? row.invite_expired
                            ? " · meghívó lejárt"
                            : " · meghívó"
                          : ""}
                      </p>
                      {row.last_activity_at ? (
                        <p className="mt-0.5 text-[11px] text-faint">
                          Aktivitás {relativeTime(row.last_activity_at)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex max-w-[240px] items-center px-2 py-1 text-[11px] font-semibold ${TONE_CLASS[st.tone]}`}
                      >
                        {st.label}
                      </span>
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
