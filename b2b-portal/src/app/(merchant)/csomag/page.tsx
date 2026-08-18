import type { Metadata } from "next";
import Link from "next/link";
import { PlanCards, formatTrialEnd } from "@/components/merchant/PlanCards";
import { requireMerchant } from "@/lib/auth/require";
import { PLAN_DEFAULTS, formatHuf, onPlan, upgradeMailto } from "@/lib/billing/plans";
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

  return (
    <div className="mx-auto w-full max-w-[920px]">
      {showDecision ? (
        <section className="tn-section mb-8">
          <p className="tn-label">Próba</p>
          <h2 className="tn-section-title mt-1">
            {overview.trialExpired
              ? "Lejárt a próba"
              : `A próba ekkor ér véget: ${end}`}
          </h2>
          <p className="tn-section-sub">
            Most {overview.partnersUsed} vevőt látsz
            {overview.isTrial ? ", a fotós lista be van kapcsolva" : ""}.{" "}
            {onPlan("Start")} {PLAN_DEFAULTS.start.partnerLimit} vevőig.{" "}
            {onPlan("Plus")} {PLAN_DEFAULTS.plus.partnerLimit}-ig.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={upgradeMailto({ plan: "plus", shopName })}
              className="tn-btn tn-btn-primary inline-flex"
            >
              Tartsd a {overview.partnersUsed} vevőt · Plus
            </a>
            <a
              href={upgradeMailto({ plan: "start", shopName })}
              className="inline-flex items-center text-[13px] font-semibold underline underline-offset-4"
            >
              Maradok a Starton · {formatHuf(PLAN_DEFAULTS.start.listPriceHuf)}
            </a>
          </div>
        </section>
      ) : overview.isTrial ? (
        <p className="mb-6 text-[13px] text-faint">
          30 napig a Pro jár (fotó igen, a Turinova jel marad). Utána{" "}
          {overview.planLabel}, {formatHuf(PLAN_DEFAULTS[overview.plan].listPriceHuf)}{" "}
          / hó. A boltban a gyors rendelés megmarad.
        </p>
      ) : null}

      <p className="tn-label">Csomagok</p>
      <h1 className="tn-section-title mt-1">
        {showDecision ? "Melyik csomag maradjon?" : "Csomagok"}
      </h1>
      <p className="tn-section-sub mb-6">
        A csomag azt szabja meg, hány rendelő vevőt látsz itt. A boltban a gyors
        rendelés ettől nem áll le.
      </p>

      <PlanCards
        currentPlan={overview.plan}
        isTrial={overview.isTrial}
        used={overview.partnersUsed}
        shopName={shopName}
      />

      <p className="mt-6 text-[13px] text-faint">
        <Link href="/home" className="font-semibold underline underline-offset-4">
          Áttekintés
        </Link>
      </p>
    </div>
  );
}
