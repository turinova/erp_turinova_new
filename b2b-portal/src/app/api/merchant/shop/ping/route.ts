import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireSettingsAdminApi,
} from "@/lib/auth/merchant-api";
import { kickCatalogSync } from "@/lib/commerce/loop";
import { withTenant } from "@/lib/db";
import { pingMerchantShop } from "@/lib/merchant/shop";

export async function POST() {
  const auth = await requireSettingsAdminApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        pingMerchantShop(client, auth.activeOrganizationId!, auth.userId),
    );
    if (result.ok) kickCatalogSync();
    return NextResponse.json({
      ok: result.ok,
      error: result.error,
      shop: result.dto,
    });
  } catch (err) {
    console.error("[POST merchant/shop/ping]", err);
    return NextResponse.json({ error: "Ping hiba" }, { status: 500 });
  }
}
