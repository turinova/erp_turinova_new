import { EmbedErrorState } from "@/components/sr-embed/EmbedErrorState";
import { EmbedHelpClient } from "@/components/sr-embed/EmbedHelpClient";
import { EmbedShell } from "@/components/sr-embed/EmbedShell";
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

export default async function SrEmbedSugoPage({
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

  return (
    <EmbedShell
      shopName={shop?.shopName ?? session.shopName}
      storeUrl={shop?.storeUrl}
      embedToken={embedToken}
    >
      <EmbedHelpClient embedToken={embedToken} />
    </EmbedShell>
  );
}
