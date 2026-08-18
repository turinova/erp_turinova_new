import type { PartnerGateDto } from "@/lib/billing/types";
import { UPGRADE_MAILTO } from "@/lib/billing/types";

export function PartnerUsageBar({
  used,
  limit,
  overCap,
  warn80,
}: {
  used: number;
  limit: number;
  overCap: boolean;
  warn80: boolean;
}) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const fill = overCap ? 100 : pct;

  return (
    <section className="tn-section">
      <p className="tn-label">Vevők a gyors rendelésből</p>
      <h2 className="tn-section-title mt-1">
        Ebben a hónapban {used} vevő rendelt
      </h2>
      <p className="tn-section-sub">
        {overCap
          ? `A csomagod ${limit} vevőt bír. A gyors rendelés ettől még megy — a plusz vevők adatai el vannak rejtve.`
          : warn80
            ? `${limit} fér el. Közel a teli — írj a Turinovának, ha több kell.`
            : `${limit} fér el a csomagodban.`}
      </p>
      <div
        className="mt-3 h-2 w-full max-w-md border border-line-strong bg-surface-2"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label="Hány vevő fért el a csomagban"
      >
        <div
          className={overCap || warn80 ? "h-full bg-warn" : "h-full bg-text"}
          style={{ width: `${fill}%` }}
        />
      </div>
    </section>
  );
}

export function UpgradeBanner({
  used,
  limit,
}: {
  used: number;
  limit: number;
}) {
  return (
    <div className="border-2 border-text bg-surface p-4">
      <p className="text-[14px] font-semibold">Elfogyott a hely</p>
      <p className="mt-1 text-[13px] text-faint">
        {used} vevő rendelt a gyors rendeléssel, a csomag {limit}-et bír. A
        gyors rendelés a boltban ettől még működik. A plusz vevőket itt nem
        látod.
      </p>
      <a href={UPGRADE_MAILTO} className="tn-btn tn-btn-primary mt-3 inline-flex">
        Írj a Turinovának
      </a>
    </div>
  );
}

export function NearLimitBanner({ limit }: { limit: number }) {
  return (
    <div className="border-[1.5px] border-line-strong bg-surface p-4">
      <p className="text-[14px] font-semibold">Közel a teli</p>
      <p className="mt-1 text-[13px] text-faint">
        A csomagod {limit} vevőt bír ebben a hónapban. Ha több kell, írj
        nekünk.
      </p>
      <a href={UPGRADE_MAILTO} className="mt-3 inline-block text-[13px] font-semibold underline underline-offset-4">
        Írj a Turinovának
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
  return {
    activePartners: o.activePartners,
    partnerLimit: o.partnerLimit,
    overCap: Boolean(o.overCap),
    warn80: Boolean(o.warn80),
    visibleInnerIds: Array.isArray(o.visibleInnerIds)
      ? o.visibleInnerIds.map(Number).filter((n) => Number.isFinite(n))
      : [],
    plan: typeof o.plan === "string" ? o.plan : "start",
    planLabel: typeof o.planLabel === "string" ? o.planLabel : "",
    isTrial: Boolean(o.isTrial),
    trialDaysLeft:
      typeof o.trialDaysLeft === "number" ? o.trialDaysLeft : null,
  };
}
