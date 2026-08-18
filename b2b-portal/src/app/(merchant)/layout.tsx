import { MerchantShell } from "@/components/merchant/MerchantShell";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadMerchantShop } from "@/lib/merchant/shop";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireMerchant();
  let impersonatingOrgName: string | null = null;
  if (session.isPlatformAdmin && session.activeOrganizationId) {
    const shop = await withTenant(
      {
        organizationId: session.activeOrganizationId,
        userId: session.userId,
        isPlatformAdmin: true,
      },
      (client) => loadMerchantShop(client, session.activeOrganizationId!),
    );
    impersonatingOrgName = shop?.shoprenterShopName ?? "a szervezet";
  }

  return (
    <MerchantShell
      email={session.email}
      displayName={session.displayName}
      impersonatingOrgName={impersonatingOrgName}
    >
      {children}
    </MerchantShell>
  );
}
