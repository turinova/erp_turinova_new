import type { PartnerGateDto } from "@/lib/billing/types";
import {
  PLAN_DEFAULTS,
  formatPlanPrice,
  upgradeMailto,
  type PlanId,
} from "@/lib/billing/plans";
import Link from "next/link";

export function PartnerUsageBar({
  used,
  limit,
  paidLimit,
  overCap,
  warn80,
  isTrial,
  planLabel,
  showPlanLink = true,
}: {
  used: number;
  limit: number;
  paidLimit: number;
  overCap: boolean;
  warn80: boolean;
  isTrial: boolean;
  planLabel?: string;
  /** Hide when already on /csomag. */
  showPlanLink?: boolean;
}) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const fill = overCap ? 100 : pct;
  const paidMark =
    isTrial && paidLimit > 0 && paidLimit < limit
      ? Math.min(100, Math.round((paidLimit / limit) * 100))
      : null;
  const paidName = planLabel || PLAN_DEFAULTS.start.label;

  return (
    <section className="tn-section">
      <p className="tn-label">Aktív vevők ebben a hónapban</p>
      <h2 className="tn-section-title mt-1">
        {used} / {limit}
      </h2>
      <p className="tn-section-sub">
        {overCap
          ? `A csomagodban legfeljebb ${limit} aktív vevő adata látható az admin felületen. A limit feletti vevők rendelései továbbra is befutnak a webshopodba.`
          : isTrial
            ? `Próba alatt legfeljebb ${limit} aktív vevő adata látható. Utána a választott csomag szerint (pl. ${paidName}: ${paidLimit}). A számláló minden hónap 1-jén nullázódik.`
            : warn80
              ? `Közeledsz a csomagod limitjéhez (legfeljebb ${limit} aktív vevő / hónap).`
              : `A csomagodban legfeljebb ${limit} aktív vevő adata látható ebben a hónapban.`}
      </p>
      <div
        className="relative mt-3 h-2 w-full max-w-md border border-line-strong bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label="Aktív vevők a csomag limitjéhez képest"
      >
        <div
          className={
            overCap || warn80 || (isTrial && used > paidLimit)
              ? "h-full bg-warn"
              : "h-full bg-text"
          }
          style={{ width: `${fill}%` }}
        />
        {paidMark != null ? (
          <span
            className="absolute top-0 h-full w-px bg-text"
            style={{ left: `${paidMark}%` }}
            title={`${paidName}: ${paidLimit}`}
          />
        ) : null}
      </div>
      {showPlanLink ? (
        <Link
          href="/csomag"
          className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-4"
        >
          Előfizetésem
        </Link>
      ) : null}
    </section>
  );
}

export function UpgradeBanner({
  used,
  limit,
  shopName,
}: {
  used: number;
  limit: number;
  shopName?: string | null;
}) {
  const href = upgradeMailto({ plan: "plus", shopName });
  return (
    <div className="border-2 border-text bg-surface p-4">
      <p className="text-[14px] font-semibold">Elérted a csomagod limitjét</p>
      <p className="mt-1 text-[13px] text-faint">
        Ebben a hónapban {used} aktív vevőd volt; a csomagodban legfeljebb{" "}
        {limit} látható az admin felületen. A rendelések a webshopodba továbbra
        is befutnak.
      </p>
      <a href={href} className="tn-btn tn-btn-primary mt-3 inline-flex">
        Saját márka: {formatPlanPrice(PLAN_DEFAULTS.plus.listPriceHuf)} / hó
      </a>
    </div>
  );
}

export function NearLimitBanner({
  used,
  limit,
  shopName,
}: {
  used: number;
  limit: number;
  shopName?: string | null;
}) {
  const href = upgradeMailto({ plan: "plus", shopName });
  return (
    <div className="border-[1.5px] border-line-strong bg-surface p-4">
      <p className="text-[14px] font-semibold">
        Közeledsz a csomagod limitjéhez
      </p>
      <p className="mt-1 text-[13px] text-faint">
        Ebben a hónapban legfeljebb {limit} aktív vevő adata látható (
        {used} / {limit}).
      </p>
      <a
        href={href}
        className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-4"
      >
        Előfizetésem
      </a>
    </div>
  );
}

export function TrialWouldLoseBanner({
  used,
  shopName,
}: {
  used: number;
  paidLimit?: number;
  planLabel?: string;
  shopName?: string | null;
}) {
  const href = upgradeMailto({ plan: "plus", shopName });
  return (
    <div className="border-[1.5px] border-line-strong bg-surface p-4">
      <p className="text-[14px] font-semibold">
        A próba után a felirat továbbra is látszik az alap előfizetésen
      </p>
      <p className="mt-1 text-[13px] text-faint">
        Most {used} aktív vevőd van. A saját márka opcióval (+felár) a ProGate
        felirat elrejthető. A rendelések a webshopodba továbbra is befutnak.
      </p>
      <a href={href} className="tn-btn tn-btn-primary mt-3 inline-flex">
        Előfizetés: saját márka
      </a>
    </div>
  );
}

export function gateFromBilling(json: unknown): PartnerGateDto | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (typeof o.activePartners !== "number" || typeof o.partnerLimit !== "number") {
    return null;
  }
  const plan = typeof o.plan === "string" ? o.plan : "start";
  return {
    activePartners: o.activePartners,
    partnerLimit: o.partnerLimit,
    paidPartnerLimit:
      typeof o.paidPartnerLimit === "number"
        ? o.paidPartnerLimit
        : PLAN_DEFAULTS.start.partnerLimit,
    overCap: Boolean(o.overCap),
    warn80: Boolean(o.warn80),
    wouldLoseOnPaid: Boolean(o.wouldLoseOnPaid),
    visibleInnerIds: Array.isArray(o.visibleInnerIds)
      ? o.visibleInnerIds.map(Number).filter((n) => Number.isFinite(n))
      : [],
    paidVisibleInnerIds: Array.isArray(o.paidVisibleInnerIds)
      ? o.paidVisibleInnerIds.map(Number).filter((n) => Number.isFinite(n))
      : [],
    plan: plan as PlanId,
    planLabel: typeof o.planLabel === "string" ? o.planLabel : "",
    isTrial: Boolean(o.isTrial),
    trialExpired: Boolean(o.trialExpired),
    trialDaysLeft:
      typeof o.trialDaysLeft === "number" ? o.trialDaysLeft : null,
    trialEndsAt: typeof o.trialEndsAt === "string" ? o.trialEndsAt : null,
  };
}
