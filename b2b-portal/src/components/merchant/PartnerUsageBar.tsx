import type { PartnerGateDto } from "@/lib/billing/types";
import {
  PLAN_DEFAULTS,
  formatHuf,
  onPlan,
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
}: {
  used: number;
  limit: number;
  paidLimit: number;
  overCap: boolean;
  warn80: boolean;
  isTrial: boolean;
  planLabel?: string;
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
      <p className="tn-label">Vevők a gyors rendelésből</p>
      <h2 className="tn-section-title mt-1">
        Ebben a hónapban {used} vevő rendelt a gyors rendeléssel
      </h2>
      <p className="tn-section-sub">
        {overCap
          ? `A csomagodba ${limit} rendelő vevő fér. A gyors rendelés ettől még megy — a plusz vevők adatait itt nem látod.`
          : isTrial
            ? `A próba alatt ${limit}-ig mindent látsz. Utána ${onPlan(paidName)} ${paidLimit}-ig látsz mindent. A szám minden hónap elsején újrakezdődik.`
            : warn80
              ? `Hamarosan betelik a csomag. ${limit} vevő fér bele ebben a hónapban.`
              : `${limit} rendelő vevő fér a csomagodba ebben a hónapban.`}
      </p>
      <div
        className="relative mt-3 h-2 w-full max-w-md border border-line-strong bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label="Hány vevő fért el a csomagban"
      >
        <div
          className={overCap || warn80 || (isTrial && used > paidLimit) ? "h-full bg-warn" : "h-full bg-text"}
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
      <Link
        href="/csomag"
        className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-4"
      >
        Csomagok
      </Link>
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
      <p className="text-[14px] font-semibold">Elfogyott a hely</p>
      <p className="mt-1 text-[13px] text-faint">
        {used} vevő rendelt a gyors rendeléssel, a csomagba {limit} fér. A
        gyors rendelés a boltban ettől még megy. A plusz vevők adatait itt nem
        látod.
      </p>
      <a href={href} className="tn-btn tn-btn-primary mt-3 inline-flex">
        Tartsd a {used} vevőt · Plus {formatHuf(PLAN_DEFAULTS.plus.listPriceHuf)}
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
      <p className="text-[14px] font-semibold">Hamarosan betelik a csomag</p>
      <p className="mt-1 text-[13px] text-faint">
        Ebben a hónapban {limit} rendelő vevő fér a csomagodba.
      </p>
      <a href={href} className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-4">
        Tartsd a {used} vevőt · Plus
      </a>
    </div>
  );
}

export function TrialWouldLoseBanner({
  used,
  paidLimit,
  planLabel,
  shopName,
}: {
  used: number;
  paidLimit: number;
  planLabel?: string;
  shopName?: string | null;
}) {
  const href = upgradeMailto({ plan: "plus", shopName });
  const paidName = planLabel || PLAN_DEFAULTS.start.label;
  return (
    <div className="border-[1.5px] border-line-strong bg-surface p-4">
      <p className="text-[14px] font-semibold">
        {onPlan(paidName)} ebből a {used} vevőből {paidLimit}-et látnál
      </p>
      <p className="mt-1 text-[13px] text-faint">
        A próba után {paidLimit} vevőig látsz mindent. {onPlan("Plus")}{" "}
        {PLAN_DEFAULTS.plus.partnerLimit}-ig.
      </p>
      <a href={href} className="tn-btn tn-btn-primary mt-3 inline-flex">
        Tartsd a {used} vevőt · Plus
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
