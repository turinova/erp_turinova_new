import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  customerDetailUseFactsEnabled,
  getShopCustomerFingerprint,
  listAllCustomerOrdersFromFacts,
  orderFactsTableExists,
} from "@/lib/merchant/customer-detail-from-db";
import {
  buildCustomerFinanceReport,
  type FinanceRangeMonths,
} from "@/lib/merchant/customer-finance";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { listCustomerOrders } from "@/lib/shoprenter";

type Ctx = { params: Promise<{ id: string }> };

const financeCache = new Map<
  string,
  { at: number; payload: ReturnType<typeof buildCustomerFinanceReport> }
>();
const FINANCE_TTL_MS = 12 * 60 * 1000;

function parseMonths(raw: string | null): FinanceRangeMonths {
  const n = Number(raw || "12");
  if (n === 3 || n === 6 || n === 24) return n;
  return 12;
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  const url = new URL(req.url);
  const months = parseMonths(url.searchParams.get("months"));
  const cacheKey = `${auth.activeOrganizationId}:${customerInnerId}:${months}`;
  const hit = financeCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FINANCE_TTL_MS) {
    return NextResponse.json({
      ok: true,
      cached: true,
      finance: hit.payload,
    });
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

        const useFacts =
          customerDetailUseFactsEnabled() &&
          (await orderFactsTableExists(client));

        let all =
          useFacts
            ? await listAllCustomerOrdersFromFacts(
                client,
                loaded.shopId,
                customerInnerId,
                {
                  sinceMs: Date.now() - months * 31 * 24 * 60 * 60 * 1000,
                },
              )
            : [];

        if (!all.length) {
          const fp = await getShopCustomerFingerprint(
            client,
            loaded.shopId,
            customerInnerId,
          );
          const page0 = await listCustomerOrders(
            loaded.config,
            customerInnerId,
            { limit: 50, page: 0, email: fp?.email },
          );
          all = [...page0.orders];
          if (page0.pageCount > 1) {
            await new Promise((r) => setTimeout(r, 400));
            const page1 = await listCustomerOrders(
              loaded.config,
              customerInnerId,
              { limit: 50, page: 1, email: fp?.email },
            );
            const seen = new Set(all.map((o) => o.id));
            for (const o of page1.orders) {
              if (!seen.has(o.id)) all.push(o);
            }
          }
        }

        all.sort((a, b) => {
          const ta = Date.parse(a.dateCreated) || 0;
          const tb = Date.parse(b.dateCreated) || 0;
          return tb - ta;
        });

        const finance = buildCustomerFinanceReport(all, { months });
        financeCache.set(cacheKey, { at: Date.now(), payload: finance });
        return { finance, source: useFacts && all.length ? "db" : "shoprenter" };
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
    console.error("[GET merchant/customers/:id/finance]", err);
    const msg =
      err instanceof Error ? err.message : "Forgalom betöltése sikertelen";
    const status =
      msg.includes("429") || msg.includes("Request Limit")
        ? 429
        : msg.includes("timeout")
          ? 504
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
