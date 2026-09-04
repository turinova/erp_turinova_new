import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import { evaluateGroupRules } from "@/lib/merchant/group-rules";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";

/**
 * POST { dryRun?: boolean, customerInnerIds?: number[], maxCustomers?: number }
 * dryRun=true (default): csak listázza, kik lépnének szintet.
 * dryRun=false: ténylegesen átrak SR-be.
 * customerInnerIds: célzott kiértékelés (pl. egy friss vevő).
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let dryRun = true;
  let customerInnerIds: number[] | undefined;
  let maxCustomers = 120;
  try {
    const body = await req.json();
    if (body && typeof body.dryRun === "boolean") dryRun = body.dryRun;
    if (body && Array.isArray(body.customerInnerIds)) {
      customerInnerIds = body.customerInnerIds
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n) && n > 0)
        .slice(0, 50);
    }
    if (body && Number.isFinite(Number(body.maxCustomers))) {
      maxCustomers = Math.min(200, Math.max(20, Number(body.maxCustomers)));
    }
  } catch {
    /* default dryRun */
  }

  try {
    await ensurePartnerGroupRulesSchema();
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
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");

        return evaluateGroupRules({
          client,
          config: loaded.config,
          shopId: loaded.shopId,
          orgId: auth.activeOrganizationId!,
          actorUserId: dryRun ? null : auth.userId,
          dryRun,
          maxCustomers,
          onlyCustomerInnerIds: customerInnerIds,
        });
      },
    );

    const sourceLabel =
      result.candidateSource === "mirror"
        ? "tükör+rendelés prioritás"
        : result.candidateSource === "targeted"
          ? "célzott vevők"
          : "élő Shoprenter recent";

    return NextResponse.json({
      ok: true,
      dryRun,
      ...result,
      message: dryRun
        ? result.hits.length
          ? `${result.hits.length} vevőt érintene a próba.`
          : "Senkit sem érintene."
        : result.applied
          ? `${result.applied} vevő átrakva.`
          : "Senki sem került át.",
      sourceLabel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[POST merchant/group-rules/run]", err);
    return NextResponse.json(
      { error: msg || "Futtatás sikertelen" },
      { status: 500 },
    );
  }
}
