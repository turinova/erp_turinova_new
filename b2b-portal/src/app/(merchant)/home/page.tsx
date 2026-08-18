import type { Metadata } from "next";
import Link from "next/link";
import {
  PartnerUsageBar,
  NearLimitBanner,
  UpgradeBanner,
  TrialWouldLoseBanner,
} from "@/components/merchant/PartnerUsageBar";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadMerchantOverview } from "@/lib/merchant/overview";

export const metadata: Metadata = {
  title: "Áttekintés",
};

export default async function MerchantHomePage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const overview = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadMerchantOverview(client, orgId),
  );

  const shopTitle = overview.shop?.shoprenterShopName ?? "Még nincs bolt";
  const next = overview.next;
  const showFomo =
    overview.trialExpired ||
    (overview.isTrial && overview.trialDaysLeft != null && overview.trialDaysLeft <= 7);

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <p className="mb-1 text-[13px] text-faint">{shopTitle}</p>
      <p className="mb-8 text-[13px] text-faint">Egy dolog, amit most csinálj.</p>

      <section className="tn-section">
        <p className="tn-label">Következő lépés</p>
        <h2 className="tn-section-title mt-1">{next.title}</h2>
        <p className="tn-section-sub">{next.body}</p>
        {next.external ? (
          <a
            href={next.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tn-btn tn-btn-primary mt-5 inline-flex"
          >
            {next.cta}
          </a>
        ) : (
          <Link href={next.href} className="tn-btn tn-btn-primary mt-5 inline-flex">
            {next.cta}
          </Link>
        )}
      </section>

      <PartnerUsageBar
        used={overview.partnersUsed}
        limit={overview.partnersLimit}
        paidLimit={overview.paidPartnerLimit}
        overCap={overview.overCap}
        warn80={overview.warn80}
        isTrial={overview.isTrial}
        planLabel={overview.planLabel}
      />
      {overview.overCap ? (
        <div className="mt-6">
          <UpgradeBanner
            used={overview.partnersUsed}
            limit={overview.partnersLimit}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : overview.wouldLoseOnPaid && showFomo ? (
        <div className="mt-6">
          <TrialWouldLoseBanner
            used={overview.partnersUsed}
            paidLimit={overview.paidPartnerLimit}
            planLabel={overview.planLabel}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : overview.warn80 && !overview.isTrial ? (
        <div className="mt-6">
          <NearLimitBanner
            used={overview.partnersUsed}
            limit={overview.partnersLimit}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : null}
    </div>
  );
}
