import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  buildShopReport,
  type ReportMonths,
} from "@/lib/merchant/shop-report";

function parseMonths(raw: string | null): ReportMonths {
  const n = Number(raw);
  if (n === 3 || n === 6 || n === 12 || n === 24) return n;
  return 12;
}

export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const months = parseMonths(url.searchParams.get("months"));

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

        const cacheKey = `${auth.activeOrganizationId}:${loaded.shopId}:${months}`;
        const report = await buildShopReport(
          loaded.config,
          client,
          loaded.shopId,
          cacheKey,
          months,
        );
        return { report };
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
    console.error("[GET merchant/reports]", err);
    const msg =
      err instanceof Error ? err.message : "Riport betöltése sikertelen";
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
