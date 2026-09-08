import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedHomeClient } from "@/components/sr-embed/EmbedHomeClient";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
import { publicAppUrl } from "@/lib/public-app-url";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";
import { getInstallCapability } from "@/lib/shoprenter/install/mode";
import { getScriptInstallState } from "@/lib/shoprenter/install/shop-script-state";
import {
  buildLegacySnippet,
  buildLoaderSnippet,
} from "@/lib/shoprenter/install/snippet";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Search = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] || "").trim();
  return (v || "").trim();
}

export default async function SrEmbedEntryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const shopname = one(sp.shopname);
  const hmac = one(sp.hmac);
  const code = one(sp.code);
  const timestamp = one(sp.timestamp);
  const dev = one(sp.dev);
  const error = one(sp.error);
  const msg = one(sp.msg);

  // Shoprenter EntryPoint arrives with HMAC quartet → bootstrap sets cookie.
  if (hmac && shopname && code && timestamp) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = one(v);
      if (val) q.set(k, val);
    }
    redirect(`/api/shoprenter/embed/bootstrap?${q.toString()}`);
  }

  if (dev === "1" && shopname) {
    redirect(
      `/api/shoprenter/embed/bootstrap?dev=1&shopname=${encodeURIComponent(shopname)}`,
    );
  }

  if (error) {
    return (
      <EmbedErrorState
        title={
          error === "shop_not_found"
            ? "Bolt nincs a ProGate-ben"
            : "Nem sikerült belépni"
        }
        detail={msg || "Nyisd meg az appot a Shoprenter adminból."}
        shopName={shopname || undefined}
      />
    );
  }

  const session = await getEmbedSessionFromCookies();
  if (!session) {
    return (
      <EmbedErrorState
        title="Nyisd meg a Shoprenterből"
        detail="Az app a Shoprenter admin iframe-jében fut. App Store → ProGate → megnyitás."
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

  const h = await headers();
  const apiBase = publicAppUrl(h);
  const script = await getScriptInstallState(shop.shopId);
  const capability = getInstallCapability();
  const snippets = {
    loader: buildLoaderSnippet({
      apiBase,
      publicId: shop.publicId,
      version: WIDGET_JS_ASSET,
    }),
    legacy: buildLegacySnippet({
      apiBase,
      publicId: shop.publicId,
      version: WIDGET_JS_ASSET,
    }),
  };

  return (
    <EmbedShell shopName={shop.shopName} storeUrl={shop.storeUrl}>
      <EmbedHomeClient
        initial={{
          shopName: shop.shopName,
          storeUrl: shop.storeUrl,
          status: shop.status,
          widgetEnabled: shop.widgetEnabled,
          catalogStatus: shop.catalogStatus,
          catalogSyncedAt: shop.catalogSyncedAt,
          hasCredentials: shop.hasCredentials,
          publicId: shop.publicId,
          orgStatus: shop.orgStatus,
          trialEndsAt: shop.trialEndsAt,
        }}
        capability={capability}
        script={script}
        snippets={snippets}
      />
    </EmbedShell>
  );
}
