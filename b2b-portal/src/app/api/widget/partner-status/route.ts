import { jsonWithCors, optionsCors } from "@/lib/cors";
import { withTenant } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import { getPartnerProgress } from "@/lib/merchant/partner-progress";
import { resolveShopContextForRequest } from "@/lib/shoprenter/resolve-shop";
import { normalizeWidgetSettings } from "@/lib/widget/presets";
import { query } from "@/lib/db";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

/**
 * Logged-in storefront customer: group name + next-level progress.
 * Query: shopId (public_id) + userId (SR inner id).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = Number(
      url.searchParams.get("userId") || url.searchParams.get("customerId") || "",
    );
    if (!Number.isFinite(userId) || userId <= 0) {
      return jsonWithCors(
        request,
        { error: "userId required" },
        { status: 400 },
      );
    }

    const shop = await resolveShopContextForRequest(request);
    await ensurePartnerGroupRulesSchema();

    const flags = await withTenant(
      {
        organizationId: shop.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      async (client) => {
        const res = await query<{ settings: unknown }>(
          client,
          `select settings from widget_settings where shop_id = $1`,
          [shop.shopId],
        );
        const norm = normalizeWidgetSettings(res.rows[0]?.settings);
        return {
          showGroupName: norm.features.showCustomerGroupName,
          showProgress: norm.features.showNextLevelProgress,
        };
      },
    );

    if (!flags.showGroupName && !flags.showProgress) {
      return jsonWithCors(request, {
        ok: true,
        progress: {
          showGroupName: false,
          showProgress: false,
          label: null,
        },
      });
    }

    const progress = await withTenant(
      {
        organizationId: shop.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      async (client) =>
        getPartnerProgress({
          client,
          config: shop.config,
          shopId: shop.shopId,
          customerInnerId: userId,
          showGroupName: flags.showGroupName,
          showProgress: flags.showProgress,
        }),
    );

    return jsonWithCors(request, { ok: true, progress });
  } catch (err) {
    console.error("[GET widget/partner-status]", err);
    return jsonWithCors(
      request,
      {
        error:
          err instanceof Error ? err.message : "partner status failed",
      },
      { status: 500 },
    );
  }
}
