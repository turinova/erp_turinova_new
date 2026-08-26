import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { formatHuf, getCustomerOrderDetail } from "@/lib/shoprenter";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Nested `/orders/[orderId]` was never registered by Next on this stack
 * (404 HTML → client JSON parse blow-up). Query-param route stays one dynamic segment.
 */
export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  const orderId = (new URL(req.url).searchParams.get("orderId") || "").trim();
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ error: "Érvénytelen rendelés" }, { status: 400 });
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

        const detail = await getCustomerOrderDetail(
          loaded.config,
          orderId,
          customerInnerId,
        );

        return {
          order: {
            id: detail.id,
            innerId: detail.innerId,
            dateLabel: detail.dateLabel,
            status: detail.status,
            totalFormatted: detail.totalFormatted,
            shippingGross: detail.shippingGross,
            shippingFormatted:
              detail.shippingGross != null
                ? formatHuf(detail.shippingGross)
                : null,
            discountGross: detail.discountGross,
            discountFormatted:
              detail.discountGross != null
                ? formatHuf(detail.discountGross)
                : null,
            paymentMethodName: detail.paymentMethodName ?? null,
            shippingMethodName: detail.shippingMethodName ?? null,
            itemCount: detail.itemCount,
            lines: detail.lines.map((l) => ({
              sku: l.sku,
              modelNumber: l.modelNumber ?? null,
              name: l.name ?? null,
              quantity: l.quantity,
              priceNetFormatted:
                l.priceNet != null ? formatHuf(l.priceNet) : null,
              priceGrossFormatted:
                l.priceGross != null ? formatHuf(l.priceGross) : null,
              lineTotalGrossFormatted:
                l.lineTotalGross != null ? formatHuf(l.lineTotalGross) : null,
              productUrl: l.productUrl ?? null,
            })),
          },
        };
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
    console.error("[GET merchant/customers/:id/order-detail]", err);
    const msg =
      err instanceof Error ? err.message : "Rendelés betöltése sikertelen";
    const status =
      msg.includes("429") || msg.includes("Request Limit")
        ? 429
        : msg.includes("does not belong")
          ? 404
          : 500;
    return NextResponse.json(
      {
        error:
          status === 429
            ? "A Shoprenter most túl sok kérést kapott (429). Várj, majd próbáld újra."
            : status === 404
              ? "A rendelés nem található ennél a vevőnél."
              : msg,
      },
      { status },
    );
  }
}
