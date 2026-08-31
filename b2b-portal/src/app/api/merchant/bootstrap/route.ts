import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { loadBootstrapSnapshot } from "@/lib/commerce/bootstrap";
import { withTenant } from "@/lib/db";
import { loadMerchantShop } from "@/lib/merchant/shop";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const orgId = auth.activeOrganizationId!;
  try {
    const data = await withTenant(
      { organizationId: orgId, userId: auth.userId },
      async (client) => {
        const shop = await loadMerchantShop(client, orgId);
        if (!shop) return { error: "NO_SHOP" as const };
        const bootstrap = await loadBootstrapSnapshot(client, shop.shopId);
        return { shopId: shop.shopId, bootstrap };
      },
    );

    if ("error" in data && data.error === "NO_SHOP") {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[GET /api/merchant/bootstrap]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
