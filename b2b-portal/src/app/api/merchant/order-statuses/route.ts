import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { listOrderStatuses } from "@/lib/shoprenter/api";

/**
 * GET /api/merchant/order-statuses
 * Live Shoprenter order statuses for automatizmus status filter UI.
 */
export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const statuses = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");
        return listOrderStatuses(loaded.config);
      },
    );

    return NextResponse.json({ statuses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs összekötött Shoprenter bolt." },
        { status: 400 },
      );
    }
    console.error("[GET merchant/order-statuses]", err);
    return NextResponse.json(
      { error: msg || "Státuszok betöltése sikertelen" },
      { status: 500 },
    );
  }
}
