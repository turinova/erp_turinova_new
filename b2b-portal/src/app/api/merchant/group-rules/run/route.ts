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
 * POST { dryRun?: boolean }
 * dryRun=true (default): csak listázza, kik lépnének szintet.
 * dryRun=false: ténylegesen átrak SR-be.
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let dryRun = true;
  try {
    const body = await req.json();
    if (body && typeof body.dryRun === "boolean") dryRun = body.dryRun;
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
          maxCustomers: 40,
        });
      },
    );

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
