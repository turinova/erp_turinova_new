import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedPricingClient } from "@/components/sr-embed/EmbedPricingClient";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { isAppStoreBillingEnabled } from "@/lib/billing/embed-pricing";
import { loadEmbedPricingConfig } from "@/lib/billing/org-billing";
import { withPlatformAdmin } from "@/lib/db";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";

export default async function SrEmbedElofizetesPage() {
  const session = await getEmbedSessionFromCookies();
  if (!session) {
    return (
      <EmbedErrorState
        title="Nyisd meg a Shoprenterből"
        detail="Nincs érvényes embed session."
      />
    );
  }
  const shop = await findEmbedShopById(session.shopId);
  if (!shop) {
    return (
      <EmbedErrorState title="Bolt nem található" shopName={session.shopName} />
    );
  }

  const pricing = await withPlatformAdmin((client) =>
    loadEmbedPricingConfig(client),
  );

  return (
    <EmbedShell shopName={shop.shopName} storeUrl={shop.storeUrl}>
      <EmbedPricingClient
        shopName={shop.shopName}
        orgStatus={shop.orgStatus}
        trialEndsAt={shop.trialEndsAt}
        pricing={pricing}
        billingEnabled={isAppStoreBillingEnabled()}
      />
    </EmbedShell>
  );
}
