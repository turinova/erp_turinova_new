import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { buildCustomerProductsReport } from "@/lib/merchant/customer-products";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) return { error: "NO_SHOP_OR_CREDS" as const };

        const cacheKey = `${auth.activeOrganizationId}:${customerInnerId}`;
        const products = await buildCustomerProductsReport(
          loaded.config,
          customerInnerId,
          cacheKey,
        );
        return { products };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[GET merchant/customers/:id/products]", err);
    const msg =
      err instanceof Error ? err.message : "Termékek betöltése sikertelen";
    const status =
      msg.includes("429") || msg.includes("Request Limit") ? 429 : 500;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "A Shoprenter most túl sok kérést kapott (429). Várj, majd próbáld újra."
            : msg,
      },
      { status },
    );
  }
}
