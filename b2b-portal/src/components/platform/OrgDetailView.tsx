"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ForceSyncButton } from "@/components/platform/ForceSyncButton";
import { OrgMembersPanel } from "@/components/platform/OrgMembersPanel";
import {
  BASE_PRICE_HUF,
  WHITE_LABEL_PRICE_HUF,
  formatPlanPrice,
  hasWhiteLabel,
  type PlanId,
} from "@/lib/billing/plans";
import { catalogLabel, healthLabel } from "@/lib/orgs/health";
import { relativeTime } from "@/lib/format";
import type { OrgDetail } from "@/lib/orgs/types";

const HEALTH_CLASS = {
  ok: "border-2 border-ok text-ok",
  warn: "border-2 border-warn text-warn",
  crit: "border-2 border-danger text-danger",
} as const;

function statusLine(detail: OrgDetail): string {
  if (detail.status === "suspended") return "Felfüggesztve";
  if (detail.trialExpired) return "Lejárt próba";
  if (detail.trialActive && detail.trialDaysLeft != null) {
    return `Próba · ${detail.trialDaysLeft} nap van hátra`;
  }
  if (detail.trialActive) return "Próba";
  return "Fizető";
}

function packageLine(plan: PlanId, isTrial: boolean): string {
  if (isTrial) {
    return `Próba. Turinova felirat látszik · utána ${formatPlanPrice(BASE_PRICE_HUF)} / hó`;
  }
  if (hasWhiteLabel(plan)) {
    return `Felirat nélkül: ${formatPlanPrice(WHITE_LABEL_PRICE_HUF)} / hó`;
  }
  return `Alap: ${formatPlanPrice(BASE_PRICE_HUF)} / hó (Turinova felirat látszik)`;
}

export function OrgDetailView({ initial }: { initial: OrgDetail }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [partnerOverride, setPartnerOverride] = useState(
    initial.partner_limit_override != null
      ? String(initial.partner_limit_override)
      : "",
  );
  const [skuOverride, setSkuOverride] = useState(
    initial.sku_limit_override != null ? String(initial.sku_limit_override) : "",
  );
  const [purgeName, setPurgeName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        organization?: OrgDetail;
      };
      if (!res.ok || !json.ok || !json.organization) {
        setError(json.error ?? "Nem sikerült");
        return;
      }
      setDetail(json.organization);
      setPartnerOverride(
        json.organization.partner_limit_override != null
          ? String(json.organization.partner_limit_override)
          : "",
      );
      setSkuOverride(
        json.organization.sku_limit_override != null
          ? String(json.organization.sku_limit_override)
          : "",
      );
      setMessage(okMsg);
      router.refresh();
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  async function impersonate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${detail.id}/impersonate`, {
        method: "POST",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Nem sikerült");
        setPending(false);
        return;
      }
      window.location.href = json.redirect ?? "/home";
    } catch {
      setError("Nincs net.");
      setPending(false);
    }
  }

  async function purge() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orgs/${detail.id}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: purgeName }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Nem törölt");
        return;
      }
      setMessage("Termékek törölve.");
      setPurgeName("");
      router.refresh();
    } catch {
      setError("Nincs net.");
    } finally {
      setPending(false);
    }
  }

  const shop = detail.shop;
  const onWhiteLabel = !detail.trialActive && hasWhiteLabel(detail.plan);
  const onBase =
    !detail.trialActive && !hasWhiteLabel(detail.plan) && detail.status !== "suspended";

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Link
        href="/admin"
        className="text-[13px] font-medium text-faint underline underline-offset-2 hover:text-text"
      >
        ← Tenantok
      </Link>

      <header className="mt-4">
        <h2 className="text-[24px] font-semibold tracking-tight">{detail.name}</h2>
        <p className="mt-1 text-[13px] text-faint">
          {shop?.shoprenter_shop_name ?? "Nincs bolt"}
          {shop?.store_url ? ` · ${shop.store_url}` : ""}
        </p>
      </header>

      <div
        className={`mt-4 inline-flex h-10 items-center px-3 text-[13px] font-bold ${HEALTH_CLASS[detail.health]}`}
      >
        {healthLabel(detail.health)} · {detail.healthReason}
      </div>

      <p className="mt-3 text-[15px] font-semibold text-text">{statusLine(detail)}</p>
      <p className="mt-1 text-[13px] text-faint">
        {packageLine(detail.plan, detail.trialActive)}
      </p>

      {error ? (
        <p className="mt-3 text-[13px] font-medium text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[13px] font-medium text-ok">{message}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void impersonate()}
          className="tn-btn tn-btn-primary"
        >
          Belépés mint ők
        </button>
        {detail.status === "suspended" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void patch(
                { status: detail.trialActive ? "trial" : "active" },
                "Élesítve",
              )
            }
            className="tn-btn tn-btn-ghost"
          >
            Élesít
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ status: "suspended" }, "Felfüggesztve")}
            className="tn-btn tn-btn-ghost"
          >
            Felfüggeszt
          </button>
        )}
      </div>

      {/* —— Csomag —— */}
      <section className="tn-section">
        <h3 className="tn-section-title">Csomag</h3>
        <p className="tn-section-sub">
          Aktiválás lezárja a próbát.
          {detail.trial_ends_at
            ? ` Próba vége: ${new Date(detail.trial_ends_at).toLocaleDateString("hu-HU")}.`
            : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || onBase}
            onClick={() =>
              void patch(
                { plan: "start", activate: true },
                `Aktiválva: Alap ${formatPlanPrice(BASE_PRICE_HUF)}`,
              )
            }
            className="tn-btn tn-btn-ghost"
          >
            Alap {formatPlanPrice(BASE_PRICE_HUF)}
            {onBase ? " · most" : ""}
          </button>
          <button
            type="button"
            disabled={pending || onWhiteLabel}
            onClick={() =>
              void patch(
                { plan: "plus", activate: true },
                `Aktiválva: Felirat nélkül ${formatPlanPrice(WHITE_LABEL_PRICE_HUF)} · logó elrejtve`,
              )
            }
            className="tn-btn tn-btn-ghost"
          >
            Felirat nélkül {formatPlanPrice(WHITE_LABEL_PRICE_HUF)}
            {onWhiteLabel ? " · most · logó elrejtve" : ""}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ extendTrialDays: 7 }, "+7 nap próba")}
            className="tn-btn tn-btn-ghost"
          >
            +7 nap próba
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void patch({ extendTrialDays: 14 }, "+14 nap próba")}
            className="tn-btn tn-btn-ghost"
          >
            +14 nap próba
          </button>
        </div>
      </section>

      {/* —— Bolt —— */}
      <section className="tn-section">
        <h3 className="tn-section-title">Bolt</h3>
        {shop ? (
          <>
            <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="tn-label">Termékek</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {shop.catalog_product_count.toLocaleString("hu-HU")}
                  <span className="font-normal text-faint">
                    {" "}
                    · {catalogLabel(shop.catalog_status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="tn-label">Kapcsolat</dt>
                <dd className="mt-1 font-semibold">
                  {shop.last_ping_ok === true
                    ? "Rendben"
                    : shop.last_ping_ok === false
                      ? "Nem megy"
                      : "—"}
                  {shop.last_ping_at ? (
                    <span className="font-normal text-faint">
                      {" "}
                      · {relativeTime(shop.last_ping_at)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="tn-label">Gyors rendelés</dt>
                <dd className="mt-1 font-semibold">
                  {shop.widget_enabled ? "Be" : "Ki"}
                </dd>
              </div>
              <div>
                <dt className="tn-label">Bolt státusz</dt>
                <dd className="mt-1 font-semibold">
                  {shop.status === "needs_reauth"
                    ? "Nem válaszol"
                    : shop.status === "draft"
                      ? "Még nincs kulcs"
                      : shop.status}
                </dd>
              </div>
            </dl>
            {shop.catalog_error ? (
              <p className="mt-3 text-[13px] text-danger">{shop.catalog_error}</p>
            ) : null}
            {shop.last_ping_error ? (
              <p className="mt-2 text-[13px] text-danger">{shop.last_ping_error}</p>
            ) : null}
            <ForceSyncButton orgId={detail.id} />
          </>
        ) : (
          <p className="mt-3 text-[13px] text-faint">Nincs bolt</p>
        )}
      </section>

      {/* —— Használat —— */}
      <section className="tn-section">
        <h3 className="tn-section-title">Használat</h3>
        <p className="mt-3 text-[28px] font-semibold tabular-nums tracking-tight">
          {detail.usage.orders7d}
          <span className="ml-2 text-[14px] font-normal text-faint">
            rendelés / 7 nap
          </span>
        </p>
        <p className="mt-2 text-[13px] text-faint">
          24 óra: {detail.usage.orders24h} · e hó: {detail.usage.ordersMonth}
        </p>
      </section>

      {/* —— Emberek —— */}
      <OrgMembersPanel
        orgId={detail.id}
        members={detail.members}
        pendingInvite={detail.pending_invite}
        onOrganization={(org) => setDetail(org)}
      />

      {/* —— Haladó —— */}
      <details className="tn-section group">
        <summary className="cursor-pointer list-none text-[15px] font-semibold tracking-tight text-text [&::-webkit-details-marker]:hidden">
          Haladó
          <span className="ml-2 text-[12px] font-normal text-faint group-open:hidden">
            limitek · másolás · napló · törlés
          </span>
        </summary>

        <div className="mt-5 space-y-8">
          <div>
            <p className="tn-label">Soft limitek (infra)</p>
            <p className="mt-1 text-[13px] text-faint">
              Vevő: {detail.partner_used} / {detail.partner_limit}
              {" · "}
              Termékhely: {detail.sku_used.toLocaleString("hu-HU")} /{" "}
              {detail.sku_limit.toLocaleString("hu-HU")}
            </p>
            <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
              <label className="tn-field">
                <span className="tn-label">Vevő-limit felülírás</span>
                <input
                  className="tn-input"
                  inputMode="numeric"
                  placeholder="üres = alapértelmezett"
                  value={partnerOverride}
                  onChange={(e) => setPartnerOverride(e.target.value)}
                />
              </label>
              <label className="tn-field">
                <span className="tn-label">Termékhely felülírás</span>
                <input
                  className="tn-input"
                  inputMode="numeric"
                  placeholder="üres = alapértelmezett"
                  value={skuOverride}
                  onChange={(e) => setSkuOverride(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void patch(
                  {
                    partnerLimitOverride: partnerOverride.trim()
                      ? Number(partnerOverride)
                      : null,
                    skuLimitOverride: skuOverride.trim()
                      ? Number(skuOverride)
                      : null,
                  },
                  "Limitek mentve",
                )
              }
              className="tn-btn tn-btn-ghost mt-3"
            >
              Limitek mentése
            </button>
          </div>

          <div>
            <p className="tn-label">ERP tölcsér (belső KPI)</p>
            <p className="mt-1 text-[13px] font-medium">
              {detail.erpQualified.qualified
                ? "erp_qualified"
                : `${detail.erpQualified.hits} / 4 jel`}
            </p>
            <ul className="mt-3 space-y-1 text-[13px]">
              {detail.erpQualified.signals.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>
                    {s.label}{" "}
                    <span className="text-faint">{s.threshold}</span>
                  </span>
                  <span
                    className={
                      s.hit ? "font-semibold text-ok" : "tabular-nums text-faint"
                    }
                  >
                    {s.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {shop ? (
            <div>
              <p className="tn-label">Technikai</p>
              <p className="mt-1 break-all font-mono text-[12px] text-faint">
                slug: {detail.slug}
                <br />
                public_id: {shop.public_id}
              </p>
              <p className="mt-2 text-[13px] text-faint">
                Widget nyitás 24ó: {detail.usage.opens24h}
              </p>
            </div>
          ) : null}

          <div>
            <p className="tn-label">Termékmásolás</p>
            {detail.jobs.length === 0 ? (
              <p className="mt-2 text-[13px] text-faint">Még nem futott másolás.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-[13px]">
                {detail.jobs.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0"
                  >
                    <span>
                      <span className="font-medium">{j.status}</span>
                      <span className="text-faint">
                        {" "}
                        · {j.pages_done}
                        {j.pages_total != null ? `/${j.pages_total}` : ""} oldal
                      </span>
                      {j.error_message ? (
                        <span className="block text-danger">{j.error_message}</span>
                      ) : null}
                    </span>
                    <span className="text-faint">{relativeTime(j.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="tn-label">Napló</p>
            {detail.audit.length === 0 ? (
              <p className="mt-2 text-[13px] text-faint">Üres.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-[13px]">
                {detail.audit.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0"
                  >
                    <span>
                      <span className="font-medium">{a.action}</span>
                      <span className="text-faint">
                        {a.actor_email ? ` · ${a.actor_email}` : ""}
                      </span>
                    </span>
                    <span className="text-faint">{relativeTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="tn-label">Veszély</p>
            <p className="mt-1 text-[13px] text-faint">
              Törli a másolt termékeket. Írd be a bolt Shoprenter nevét.
            </p>
            <input
              className="tn-input mt-3 max-w-sm"
              value={purgeName}
              onChange={(e) => setPurgeName(e.target.value)}
              placeholder={shop?.shoprenter_shop_name ?? "bolt neve"}
            />
            <button
              type="button"
              disabled={pending || !purgeName.trim()}
              onClick={() => void purge()}
              className="tn-btn tn-btn-ghost mt-3"
            >
              Termékek törlése
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
