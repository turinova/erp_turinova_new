"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ForceSyncButton } from "@/components/platform/ForceSyncButton";
import { ResendInviteButton } from "@/components/platform/ResendInviteButton";
import { PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { relativeTime } from "@/lib/format";
import { catalogLabel, healthLabel } from "@/lib/orgs/health";
import type { OrgDetail } from "@/lib/orgs/types";

const HEALTH_CLASS = {
  ok: "border-2 border-ok text-ok",
  warn: "border-2 border-warn text-warn",
  crit: "border-2 border-danger text-danger",
} as const;

export function OrgDetailView({ initial }: { initial: OrgDetail }) {
  const router = useRouter();
  const [detail, setDetail] = useState(initial);
  const [plan, setPlan] = useState<PlanId>(initial.plan);
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
      setPlan(json.organization.plan);
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
      const json = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
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
  const fill =
    detail.partner_limit <= 0
      ? 0
      : Math.min(100, Math.round((detail.partner_used / detail.partner_limit) * 100));
  const skuFill =
    detail.sku_limit <= 0
      ? 0
      : Math.min(100, Math.round((detail.sku_used / detail.sku_limit) * 100));

  const sentenceParts: string[] = [];
  if (detail.trialExpired) sentenceParts.push("lejárt próba");
  else if (detail.trialActive && detail.trialDaysLeft != null) {
    sentenceParts.push(`próba, ${detail.trialDaysLeft} nap`);
  } else {
    sentenceParts.push(detail.plan);
  }
  sentenceParts.push(
    shop
      ? `termékek ${catalogLabel(shop.catalog_status)}`
      : "nincs bolt",
  );
  sentenceParts.push(
    `${detail.partner_used} vevő rendelt / ${detail.partner_limit} fér el`,
  );
  sentenceParts.push(
    `gyors rendelés ${shop?.widget_enabled ? "be" : "ki"}`,
  );

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <Link
        href="/admin"
        className="text-[13px] font-medium text-faint underline underline-offset-2 hover:text-text"
      >
        Tenantok
      </Link>

      <header className="mt-4 mb-2">
        <h2 className="text-[28px] font-semibold tracking-tight">{detail.name}</h2>
        <p className="mt-1 text-[13px] text-faint">
          {detail.slug}
          {shop ? ` · ${shop.shoprenter_shop_name}` : ""}
        </p>
      </header>

      <div className={`mt-4 inline-flex h-10 items-center px-3 text-[13px] font-bold ${HEALTH_CLASS[detail.health]}`}>
        {healthLabel(detail.health)} · {detail.healthReason}
      </div>

      <p className="mt-3 max-w-2xl text-[14px] text-faint">
        {sentenceParts.join(" · ")}.
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

      <section className="tn-section">
        <p className="tn-label">Számlázás</p>
        <h3 className="tn-section-title mt-1">
          {detail.partner_used} / {detail.partner_limit} vevő ebben a hónapban
        </h3>
        <p className="tn-section-sub">
          {detail.overCap
            ? "A portál a plusz vevőket elrejti. A gyors rendelés a boltban megy."
            : detail.warn80
              ? "Közel a teli."
              : "A csomag bírja."}
          {detail.trialActive
            ? " Próba alatt a Pro limitek mennek."
            : ""}
        </p>
        <div className="mt-3 h-2 w-full max-w-md border border-line-strong bg-surface-2">
          <div
            className={detail.overCap || detail.warn80 ? "h-full bg-warn" : "h-full bg-text"}
            style={{ width: `${fill}%` }}
          />
        </div>
        <p className="mt-4 text-[13px] text-faint">
          Termékhely: {detail.sku_used.toLocaleString("hu-HU")} /{" "}
          {detail.sku_limit.toLocaleString("hu-HU")}
        </p>
        <div className="mt-1 h-1.5 w-full max-w-md border border-line-strong bg-surface-2">
          <div className="h-full bg-text" style={{ width: `${skuFill}%` }} />
        </div>

        <div className="mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="tn-field">
            <span className="tn-label">Csomag</span>
            <select
              className="tn-input"
              value={plan}
              onChange={(e) => setPlan(e.target.value as PlanId)}
            >
              {PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="tn-field">
            <span className="tn-label">Vevő-limit felülírás</span>
            <input
              className="tn-input"
              inputMode="numeric"
              placeholder={`alap: ${detail.partner_limit}`}
              value={partnerOverride}
              onChange={(e) => setPartnerOverride(e.target.value)}
            />
          </label>
          <label className="tn-field">
            <span className="tn-label">Termékhely felülírás</span>
            <input
              className="tn-input"
              inputMode="numeric"
              placeholder={`alap: ${detail.sku_limit}`}
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
                plan,
                partnerLimitOverride: partnerOverride.trim()
                  ? Number(partnerOverride)
                  : null,
                skuLimitOverride: skuOverride.trim()
                  ? Number(skuOverride)
                  : null,
              },
              "Mentve",
            )
          }
          className="tn-btn tn-btn-primary mt-4"
        >
          Csomag / limitek mentése
        </button>
      </section>

      <section className="tn-section">
        <h3 className="tn-section-title">Bolt</h3>
        {shop ? (
          <>
            <dl className="mt-5 grid gap-4 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="tn-label">Név</dt>
                <dd className="mt-1 font-medium">{shop.shoprenter_shop_name}</dd>
              </div>
              <div>
                <dt className="tn-label">Bolt állapota</dt>
                <dd className="mt-1 font-medium">
                  {shop.status === "needs_reauth"
                    ? "nem válaszol"
                    : shop.status === "draft"
                      ? "még nincs kulcs"
                      : shop.status}
                </dd>
              </div>
              <div>
                <dt className="tn-label">URL</dt>
                <dd className="mt-1 font-medium">{shop.store_url ?? "—"}</dd>
              </div>
              <div>
                <dt className="tn-label">public_id</dt>
                <dd className="mt-1 break-all font-mono text-[12px]">
                  {shop.public_id}
                </dd>
              </div>
              <div>
                <dt className="tn-label">Termékek</dt>
                <dd className="mt-1 font-medium">
                  {shop.catalog_product_count.toLocaleString("hu-HU")} ·{" "}
                  {catalogLabel(shop.catalog_status)}
                </dd>
              </div>
              <div>
                <dt className="tn-label">Utolsó teszt</dt>
                <dd className="mt-1 font-medium">
                  {shop.last_ping_ok === true
                    ? "rendben"
                    : shop.last_ping_ok === false
                      ? "nem megy"
                      : "—"}
                  {shop.last_ping_at ? ` · ${relativeTime(shop.last_ping_at)}` : ""}
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

      <section className="tn-section">
        <h3 className="tn-section-title">Használat</h3>
        <p className="tn-section-sub">
          A nyitás csak szám, nem számlázás. A rendelés számít a vevőcsomagba.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-4">
          <div>
            <dt className="tn-label">Rendelés 24ó</dt>
            <dd className="mt-1 font-semibold tabular-nums">{detail.usage.orders24h}</dd>
          </div>
          <div>
            <dt className="tn-label">Rendelés 7 nap</dt>
            <dd className="mt-1 font-semibold tabular-nums">{detail.usage.orders7d}</dd>
          </div>
          <div>
            <dt className="tn-label">Rendelés e hó</dt>
            <dd className="mt-1 font-semibold tabular-nums">{detail.usage.ordersMonth}</dd>
          </div>
          <div>
            <dt className="tn-label">Nyitás 24ó</dt>
            <dd className="mt-1 font-semibold tabular-nums">{detail.usage.opens24h}</dd>
          </div>
        </dl>
      </section>

      <section className="tn-section">
        <h3 className="tn-section-title">Termékmásolás</h3>
        {detail.jobs.length === 0 ? (
          <p className="mt-3 text-[13px] text-faint">Még nem futott másolás.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-[13px]">
            {detail.jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0">
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
      </section>

      <section className="tn-section">
        <h3 className="tn-section-title">Emberek</h3>
        {detail.members.length === 0 && !detail.pending_invite ? (
          <p className="mt-3 text-[13px] text-faint">Nincs tag</p>
        ) : null}
        <ul className="mt-4 space-y-3 text-[14px]">
          {detail.members.map((m) => (
            <li key={m.email} className="flex justify-between gap-2">
              <span>
                <span className="font-medium">{m.email}</span>
                <span className="text-faint"> · {m.role}</span>
              </span>
              <span className="text-faint">
                {m.last_login_at ? relativeTime(m.last_login_at) : "még nem lépett be"}
              </span>
            </li>
          ))}
          {detail.pending_invite ? (
            <li className="text-warn">
              Függő meghívó: {detail.pending_invite.email}
              {" · "}
              {new Date(detail.pending_invite.expires_at) <= new Date()
                ? "lejárt"
                : `lejár ${new Date(detail.pending_invite.expires_at).toLocaleDateString("hu-HU")}`}
            </li>
          ) : null}
        </ul>
        {detail.pending_invite ? (
          <div className="mt-4">
            <ResendInviteButton orgId={detail.id} />
          </div>
        ) : null}
      </section>

      <section className="tn-section">
        <h3 className="tn-section-title">Napló</h3>
        {detail.audit.length === 0 ? (
          <p className="mt-3 text-[13px] text-faint">Üres.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-[13px]">
            {detail.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-0">
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
      </section>

      <section className="tn-section">
        <h3 className="tn-section-title">Veszély</h3>
        <p className="tn-section-sub">
          Törli a másolt termékeket. A gyors rendelés keresője üres lesz, amíg újra
          másoltok. Írd be a bolt Shoprenter nevét.
        </p>
        <input
          className="tn-input mt-4 max-w-sm"
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
      </section>
    </div>
  );
}
