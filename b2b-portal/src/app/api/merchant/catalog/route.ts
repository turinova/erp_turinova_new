import { NextResponse } from "next/server";
import { effectiveSkuLimit } from "@/lib/billing/active-partners";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { countOrgActiveSkus } from "@/lib/commerce/catalog";
import { loadLatestJob, loadShopForSync } from "@/lib/commerce/jobs";
import { withTenant } from "@/lib/db";
import { loadPartnerGate } from "@/lib/merchant/overview";
import { loadMerchantShop } from "@/lib/merchant/shop";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const orgId = auth.activeOrganizationId!;
  try {
    const data = await withTenant(
      { organizationId: orgId, userId: auth.userId },
      async (client) => {
        const shopDto = await loadMerchantShop(client, orgId);
        if (!shopDto) return { error: "NO_SHOP" as const };
        const shop = await loadShopForSync(client, shopDto.shopId);
        const job = await loadLatestJob(client, shopDto.shopId);
        const [skuUsed, skuLimit, gate] =
          await Promise.all([
            countOrgActiveSkus(client, orgId),
            effectiveSkuLimit(client, orgId),
            loadPartnerGate(client, orgId),
          ]);
        const pagesDone = job?.pages_done ?? 0;
        const pagesTotal = job?.pages_total ?? null;
        const progressPct =
          pagesTotal && pagesTotal > 0
            ? Math.min(100, Math.round((pagesDone / pagesTotal) * 100))
            : shop?.catalog_status === "ready"
              ? 100
              : 0;
        return {
          shopId: shopDto.shopId,
          catalogStatus: shop?.catalog_status ?? "pending",
          productCount: skuUsed,
          readyAt: shop?.catalog_ready_at ?? null,
          syncedAt: shop?.catalog_synced_at ?? null,
          error: shop?.catalog_error ?? null,
          progressPct,
          job: job
            ? {
                id: job.id,
                status: job.status,
                kind: job.kind,
                pagesDone: job.pages_done,
                pagesTotal: job.pages_total,
                productsUpserted: job.products_upserted,
                errorCode: job.error_code,
                errorMessage: job.error_message,
              }
            : null,
          skuUsed,
          skuLimit,
          partnerUsed: gate.activePartners,
          partnerLimit: gate.partnerLimit,
          paidPartnerLimit: gate.paidPartnerLimit,
          planLabel: gate.planLabel,
          isTrial: gate.isTrial,
          overCap: gate.overCap,
          warn80: gate.warn80,
        };
      },
    );

    if ("error" in data && data.error === "NO_SHOP") {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[GET /api/merchant/catalog]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
