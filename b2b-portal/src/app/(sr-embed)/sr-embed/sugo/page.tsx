import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedHelpClient } from "@/components/sr-embed/EmbedHelpClient";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";

export default async function SrEmbedSugoPage() {
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

  return (
    <EmbedShell
      shopName={shop?.shopName ?? session.shopName}
      storeUrl={shop?.storeUrl}
    >
      <EmbedHelpClient />
    </EmbedShell>
  );
}
