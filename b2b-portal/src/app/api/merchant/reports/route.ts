import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant, withPlatformAdmin } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  buildShopReport,
  type ReportMonths,
  type ReportPhase,
} from "@/lib/merchant/shop-report";
import {
  buildShopReportFromDb,
  orderFactsCoverageOk,
  orderFactsSchemaReady,
} from "@/lib/merchant/shop-report-from-db";

function parseMonths(raw: string | null): ReportMonths {
  const n = Number(raw);
  if (n === 3 || n === 6 || n === 12 || n === 24) return n;
  return 6;
}

function parsePhase(raw: string | null): ReportPhase {
  if (raw === "products" || raw === "full" || raw === "summary") return raw;
  return "summary";
}

function useOrderFacts(): boolean {
  return process.env.REPORT_USE_ORDER_FACTS === "1";
}

export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const months = parseMonths(url.searchParams.get("months"));
  const phase = parsePhase(url.searchParams.get("phase"));

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

        if (useOrderFacts() && (phase === "summary" || phase === "full")) {
          const ready = await orderFactsSchemaReady(client);
          if (ready) {
            const coverage = await orderFactsCoverageOk(
              client,
              loaded.shopId,
              months,
            );
            if (coverage.ok) {
              const report = await buildShopReportFromDb(
                client,
                loaded.shopId,
                months,
              );
              return {
                report,
                source: "db" as const,
                syncedAt: coverage.newestSyncedAt,
              };
            }
            return {
              liveFallback: true as const,
              coverageHint: coverage.hint,
              report: await buildShopReport(
                loaded.config,
                client,
                loaded.shopId,
                cacheKey,
                months,
                phase === "full" ? "full" : "summary",
              ),
              source: "live" as const,
            };
          }
        }

        const report = await buildShopReport(
          loaded.config,
          client,
          loaded.shopId,
          cacheKey,
          months,
          phase,
        );
        return { report, source: "live" as const };
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

/** Kick one order-facts sync tick for this merchant shop. */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const { kickOrderFactsForOrg } = await import(
      "@/lib/commerce/order-facts-sync"
    );
    const out = await withPlatformAdmin(
      async (client) =>
        kickOrderFactsForOrg(client, auth.activeOrganizationId!),
      auth.userId,
    );
    return NextResponse.json({ ...out, ok: true });
  } catch (err) {
    console.error("[POST merchant/reports]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Riport sync sikertelen",
      },
      { status: 500 },
    );
  }
}
