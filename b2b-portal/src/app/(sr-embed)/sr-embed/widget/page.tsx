import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedWidgetEditor } from "@/components/sr-embed/EmbedWidgetEditor";
import { withTenant } from "@/lib/db";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";
import { loadMerchantWidget } from "@/lib/widget/settings";

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

export default async function SrEmbedWidgetPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const tabRaw = one(sp.tab);
  const initialTab = tabRaw === "extra" ? "extra" : "button";

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
      <EmbedErrorState
        title="Bolt nem található"
        detail="A session boltja már nincs a rendszerben."
        shopName={session.shopName}
      />
    );
  }

  const widget = await withTenant(
    {
      organizationId: session.organizationId,
      userId: null,
      isPlatformAdmin: true,
    },
    (client) => loadMerchantWidget(client, session.organizationId),
  );

  if (!widget) {
    return (
      <EmbedErrorState
        title="Nincs widget beállítás"
        detail="A bolthoz még nincs widget_settings sor."
        shopName={shop.shopName}
      />
    );
  }

  return (
    <EmbedWidgetEditor
      initial={widget}
      shopName={shop.shopName}
      storeUrl={shop.storeUrl}
      catalogStatus={shop.catalogStatus}
      initialTab={initialTab}
    />
  );
}
