import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { enqueueFullSync } from "@/lib/commerce/jobs";
import { kickCatalogSync } from "@/lib/commerce/loop";
import { withTenant } from "@/lib/db";
import { loadMerchantShop } from "@/lib/merchant/shop";

export async function POST() {
  const auth = await requireMerchantApi();
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
        const enq = await enqueueFullSync(client, shop.shopId, orgId);
        return { jobId: enq.jobId, created: enq.created };
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

    kickCatalogSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[POST /api/merchant/catalog/resync]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
