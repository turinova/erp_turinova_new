import { MerchantShell } from "@/components/merchant/MerchantShell";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadPartnerGate } from "@/lib/merchant/overview";
import { loadMerchantShop } from "@/lib/merchant/shop";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const { impersonatingOrgName, trialChip } = await withTenant(
    {
      organizationId: orgId,
      userId: session.userId,
      isPlatformAdmin: session.isPlatformAdmin,
    },
    async (client) => {
      const [shop, gate] = await Promise.all([
        session.isPlatformAdmin
          ? loadMerchantShop(client, orgId)
          : Promise.resolve(null),
        loadPartnerGate(client, orgId),
      ]);
      return {
        impersonatingOrgName: session.isPlatformAdmin
          ? (shop?.shoprenterShopName ?? "a szervezet")
          : null,
        trialChip:
          gate.isTrial || gate.trialExpired
            ? {
                daysLeft: gate.trialDaysLeft,
                expired: gate.trialExpired,
                planLabel: gate.planLabel,
                trialEndsAt: gate.trialEndsAt,
              }
            : null,
      };
    },
  );

  return (
    <MerchantShell
      email={session.email}
      displayName={session.displayName}
      impersonatingOrgName={impersonatingOrgName}
      trialChip={trialChip}
    >
      {children}
    </MerchantShell>
  );
}
