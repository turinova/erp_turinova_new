import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireSettingsAdminApi,
} from "@/lib/auth/merchant-api";
import { kickBootstrapWorkers, startShopBootstrap } from "@/lib/commerce/bootstrap";
import { withTenant } from "@/lib/db";
import { loadMerchantShop } from "@/lib/merchant/shop";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";

export async function POST() {
  const auth = await requireSettingsAdminApi();
  if (isErrorResponse(auth)) return auth;

  const orgId = auth.activeOrganizationId!;
  try {
    const result = await withTenant(
      { organizationId: orgId, userId: auth.userId },
      async (client) => {
        const shop = await loadMerchantShop(client, orgId);
        if (!shop) return { error: "NO_SHOP" as const };
        if (!shop.hasCredentials) return { error: "NO_CREDS" as const };
        if (shop.status === "needs_reauth") {
          return { error: "REAUTH" as const };
        }
        const loaded = await loadMerchantShoprenterConfig(client, orgId);
        if (!loaded) return { error: "NO_CREDS" as const };
        const enq = await startShopBootstrap(
          client,
          shop.shopId,
          orgId,
          loaded.config,
          { force: true },
        );
        return { jobId: enq.catalogJobId, created: true };
      },
    );

    if ("error" in result) {
      if (result.error === "NO_SHOP") {
        return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
      }
      if (result.error === "NO_CREDS") {
        return NextResponse.json(
          { error: "Előbb mentsd az API kulcsot" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "Shop újrahitelesítés kell" },
        { status: 409 },
      );
    }

    kickBootstrapWorkers();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/merchant/catalog/resync]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
