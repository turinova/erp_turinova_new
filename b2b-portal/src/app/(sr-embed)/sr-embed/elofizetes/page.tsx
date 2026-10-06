import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedPricingClient } from "@/components/sr-embed/EmbedPricingClient";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { isAppStoreBillingEnabled } from "@/lib/billing/embed-pricing";
import { loadEmbedPricingConfig } from "@/lib/billing/org-billing";
import { withPlatformAdmin } from "@/lib/db";
import {
  EMBED_SESSION_QUERY,
  resolveEmbedSession,
} from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

export default async function SrEmbedElofizetesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const resolved = await resolveEmbedSession(one(sp[EMBED_SESSION_QUERY]));
  if (!resolved) {
    return (
      <EmbedErrorState
        title="Nyisd meg a Shoprenterből"
        detail="Nincs érvényes embed session."
      />
    );
  }
  const { session, token: embedToken } = resolved;
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
    <EmbedShell
      shopName={shop.shopName}
      storeUrl={shop.storeUrl}
      embedToken={embedToken}
    >
      <EmbedPricingClient
        shopName={shop.shopName}
        orgStatus={shop.orgStatus}
        trialEndsAt={shop.trialEndsAt}
        pricing={pricing}
        billingEnabled={isAppStoreBillingEnabled()}
        embedToken={embedToken}
      />
    </EmbedShell>
  );
}
