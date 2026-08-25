import type { Metadata } from "next";
import { PlanCards } from "@/components/merchant/PlanCards";
import { requireMerchant } from "@/lib/auth/require";
import { PLAN_DEFAULTS, formatTrialEnd, onPlan } from "@/lib/billing/plans";
import { withTenant } from "@/lib/db";
import { loadMerchantOverview } from "@/lib/merchant/overview";

export const metadata: Metadata = {
  title: "Csomagok",
};

export default async function MerchantPlansPage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const overview = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadMerchantOverview(client, orgId),
  );
  const shopName = overview.shop?.shoprenterShopName;
  const end = formatTrialEnd(overview.trialEndsAt);
  const showDecision =
    overview.trialExpired ||
    (overview.isTrial && overview.trialDaysLeft != null && overview.trialDaysLeft <= 7);
  const used = overview.partnersUsed;
  const startLimit = PLAN_DEFAULTS.start.partnerLimit;

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusPill
          isTrial={overview.isTrial}
          trialExpired={overview.trialExpired}
          trialDaysLeft={overview.trialDaysLeft}
          planLabel={overview.planLabel}
        />
        <p className="text-[13px] text-faint">
          {overview.trialExpired ? (
            <>
              Most csak {startLimit} vevőt látsz
              {used > startLimit ? ` · ${used} helyett` : ""}
            </>
          ) : (
            <>
              Most {used} vevőt látsz
              {overview.isTrial ? " · a fotós lista be van kapcsolva" : ""}
              {overview.isTrial && end ? ` · a próba ekkor ér véget: ${end}` : ""}
            </>
          )}
        </p>
      </div>

      <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
        {showDecision
          ? "Melyik csomagot tartod meg?"
          : "Válaszd ki, hány vevőt akarsz látni."}
      </h1>
      <p className="tn-section-sub mb-6">
        {showDecision
          ? `A próba után a Starton csak ${startLimit} vevőt látsz. A fotós lista kikapcsol. A Plus megtartja a tiédet.`
          : "A boltban a rendelés mindhárom csomagban megy. Itt az a kérdés: hány rendelő vevőt látsz te."}
      </p>

      <PlanCards
        currentPlan={overview.plan}
        isTrial={overview.isTrial}
        used={used}
        shopName={shopName}
      />
    </div>
  );
}

function StatusPill({
  isTrial,
  trialExpired,
  trialDaysLeft,
  planLabel,
}: {
  isTrial: boolean;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  planLabel: string;
}) {
  if (trialExpired) {
    return (
      <span className="inline-flex shrink-0 border-2 border-warn px-2 py-1 text-[11px] font-bold text-warn">
        Lejárt a próba
      </span>
    );
  }
  if (isTrial) {
    const label =
      trialDaysLeft === 0
        ? "Ma lejár"
        : trialDaysLeft === 1
          ? "Holnap lejár"
          : trialDaysLeft != null
            ? `Próba · ${trialDaysLeft} nap van hátra`
            : "Próba";
    const urgent = trialDaysLeft != null && trialDaysLeft <= 3;
    return (
      <span
        className={
          urgent
            ? "inline-flex shrink-0 border-2 border-warn px-2 py-1 text-[11px] font-bold text-warn"
            : "inline-flex shrink-0 border-2 border-text px-2 py-1 text-[11px] font-bold"
        }
      >
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 border border-line-strong px-2 py-1 text-[11px] font-semibold text-faint">
      Most {onPlan(planLabel)} vagy
    </span>
  );
}
