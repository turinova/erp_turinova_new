import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  buildCustomersImportTemplateWorkbook,
  xlsxResponse,
} from "@/lib/merchant/customers-xlsx";
import { listCustomerGroups } from "@/lib/shoprenter/customers";

/** GET → sablon .xlsx (email + csoport) + Csoportok lap. */
export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

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
        return {
          names: srGroups.map((g) => g.name).filter(Boolean),
        };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    const buf = buildCustomersImportTemplateWorkbook(result.names);
    return xlsxResponse(buf, "vevok-import-sablon.xlsx");
  } catch (err) {
    console.error("[GET merchant/customers/import/template]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sablon hiba" },
      { status: 500 },
    );
  }
}
