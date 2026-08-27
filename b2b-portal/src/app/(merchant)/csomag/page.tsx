import type { Metadata } from "next";
import { PlanCards } from "@/components/merchant/PlanCards";
import { requireMerchant } from "@/lib/auth/require";
import {
  formatTrialEnd,
  hasWhiteLabel,
} from "@/lib/billing/plans";
import { withTenant } from "@/lib/db";
import { loadMerchantOverview } from "@/lib/merchant/overview";

export const metadata: Metadata = {
  title: "Előfizetésem",
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
  const whiteLabel = !overview.isTrial && hasWhiteLabel(overview.plan);

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <header className="mb-6">
        <StatusPill
          isTrial={overview.isTrial}
          trialExpired={overview.trialExpired}
          trialDaysLeft={overview.trialDaysLeft}
          whiteLabel={whiteLabel}
        />
        {overview.isTrial && end && !overview.trialExpired ? (
          <p className="mt-3 text-[15px] font-semibold tracking-tight text-text">
            {trialEndsHeadline(overview.trialDaysLeft, end)}
          </p>
        ) : null}
        {overview.trialExpired ? (
          <p className="mt-3 text-[15px] font-semibold tracking-tight text-text">
            A próbaidőszakod lejárt. Válaszd az előfizetést, hogy hivatalosan is
            nálad maradjon a szolgáltatás.
          </p>
        ) : null}
      </header>

      <h1 className="mb-6 text-[28px] font-semibold leading-tight tracking-tight">
        Előfizetés
      </h1>

      <PlanCards
        currentPlan={overview.plan}
        isTrial={overview.isTrial}
        shopName={shopName}
      />
    </div>
  );
}

function trialEndsHeadline(
  daysLeft: number | null,
  endFormatted: string,
): string {
  if (daysLeft === 0) {
    return `A próbaidőszakod ma lejár (${endFormatted}).`;
  }
  if (daysLeft === 1) {
    return `A próbaidőszakod holnap, ${endFormatted} lejár.`;
  }
  return `A próbaidőszakod ${endFormatted} lejár.`;
}

function StatusPill({
  isTrial,
  trialExpired,
  trialDaysLeft,
  whiteLabel,
}: {
  isTrial: boolean;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  whiteLabel: boolean;
}) {
  if (trialExpired) {
    return (
      <span className="inline-flex shrink-0 border-2 border-warn px-2 py-1 text-[11px] font-bold text-warn">
        Lejárt a próbaidőszak
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
            ? `Próbaidőszak · még ${trialDaysLeft} nap`
            : "Próbaidőszak";
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
      {whiteLabel ? "Gyors rendelés + saját márka" : "Gyors rendelés"}
    </span>
  );
}
