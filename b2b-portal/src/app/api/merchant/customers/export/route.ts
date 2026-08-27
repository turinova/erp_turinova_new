import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { collectFilteredCustomers, parseCustomerListFilter } from "@/lib/merchant/customers-list";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  buildCustomersExportWorkbook,
  xlsxResponse,
} from "@/lib/merchant/customers-xlsx";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

/**
 * GET /api/merchant/customers/export?filter=&q=&groupInnerId=
 * → .xlsx of filtered customers (capped).
 */
export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const filter = parseCustomerListFilter(url.searchParams.get("filter") || "all");
  const q = (url.searchParams.get("q") || "").trim();
  const groupInnerRaw = url.searchParams.get("groupInnerId");
  const groupInnerId =
    groupInnerRaw != null && groupInnerRaw !== ""
      ? Number(groupInnerRaw)
      : null;

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

        const srGroups = await listCustomerGroups(loaded.config);
        const defaultIds = new Set(
          srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
        );

        const rows = await collectFilteredCustomers({
          config: loaded.config,
          groups: srGroups,
          defaultIds,
          filter: q ? "all" : filter,
          groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
          q,
          maxRows: 1500,
          maxSrPages: 40,
        });

        return {
          rows,
          groupNames: srGroups.map((g) => g.name).filter(Boolean),
        };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    const buf = buildCustomersExportWorkbook(
      result.rows,
      result.groupNames,
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return xlsxResponse(buf, `vevok-${stamp}.xlsx`);
  } catch (err) {
    console.error("[GET merchant/customers/export]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Excel export sikertelen",
      },
      { status: 500 },
    );
  }
}
