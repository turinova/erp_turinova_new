import type { Metadata } from "next";
import { PartnerActivationView } from "@/components/merchant/PartnerActivationView";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadPartnerActivation } from "@/lib/merchant/partner-activation-data";

export const metadata: Metadata = {
  title: "Partnerek aktiválása",
};

export default async function PartnerActivationPage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const activation = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadPartnerActivation(client, orgId),
  );

  if (!activation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[14px] font-semibold">Még nincs bolt</p>
        <p className="mt-1 text-[12px] text-faint">
          A Turinovának előbb létre kell hoznia a boltot.
        </p>
      </div>
    );
  }

  return <PartnerActivationView initial={activation} />;
}
