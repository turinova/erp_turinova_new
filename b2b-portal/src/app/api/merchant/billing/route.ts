import { NextResponse } from "next/server";
import { countActivePartnersMonthByShop } from "@/lib/billing/active-partners";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadPartnerGate } from "@/lib/merchant/overview";

/** Active Partner meter — widget-rendelők a naptári hónapban (D3). */
export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const orgId = auth.activeOrganizationId!;
  const month = new Date();

  try {
    const data = await withTenant(
      { organizationId: orgId, userId: auth.userId },
      async (client) => {
        const [gate, byShop] = await Promise.all([
          loadPartnerGate(client, orgId),
          countActivePartnersMonthByShop(client, orgId, month),
        ]);
        return { ...gate, byShop };
      },
    );

    const y = month.getFullYear();
    const m = String(month.getMonth() + 1).padStart(2, "0");
    return NextResponse.json({
      ok: true,
      month: `${y}-${m}`,
      ...data,
    });
  } catch (err) {
    console.error("[GET /api/merchant/billing]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
