import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  listCustomerGroups,
  listRecentCustomers,
  searchCustomers,
} from "@/lib/shoprenter/customers";

export type CustomerListFilter = "newcomers" | "partners" | "all";

function parseFilter(raw: string): CustomerListFilter {
  if (raw === "partners" || raw === "all") return raw;
  if (raw === "newcomers" || raw === "pending") return "newcomers";
  return "newcomers";
}

export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = parseFilter(url.searchParams.get("filter") || "newcomers");
  const groupInnerRaw = url.searchParams.get("groupInnerId");
  const groupInnerId =
    groupInnerRaw != null && groupInnerRaw !== ""
      ? Number(groupInnerRaw)
      : null;
  const page = Math.max(0, Number(url.searchParams.get("page") || "0") || 0);
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit") || "25") || 25),
  );

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

        // Egy csoportlista → név/ID resolve helyi cache-ből (nincs N+1 SR hívás)
        const srGroups = await listCustomerGroups(loaded.config);
        const defaultIds = new Set(
          srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
        );

        let pageCount = 1;
        let customers;
        if (q) {
          customers = await searchCustomers(loaded.config, q, {
            limit: Math.min(50, limit),
            groups: srGroups,
          });
          pageCount = 1;
        } else {
          const listed = await listRecentCustomers(loaded.config, {
            limit,
            page,
            groups: srGroups,
          });
          customers = listed.customers;
          pageCount = listed.pageCount;
        }

        const mapped = customers.map((c) => {
          const isDefaultGroup =
            c.groupInnerId != null && defaultIds.has(c.groupInnerId);
          return {
            id: c.id,
            innerId: c.innerId,
            email: c.email,
            name:
              [c.lastname, c.firstname].filter(Boolean).join(" ").trim() ||
              c.email,
            telephone: c.telephone,
            approved: c.approved,
            dateCreated: c.dateCreated,
            groupInnerId: c.groupInnerId,
            groupName: c.groupName,
            isDefaultGroup,
            /** Partner = nem az alap csoportban (átrakva / más klub) */
            isPartner: c.groupInnerId != null && !isDefaultGroup,
          };
        });

        let list = mapped;
        if (Number.isFinite(groupInnerId) && groupInnerId != null) {
          list = mapped.filter((c) => c.groupInnerId === groupInnerId);
        } else if (filter === "newcomers") {
          list = mapped.filter((c) => c.isDefaultGroup);
        } else if (filter === "partners") {
          list = mapped.filter((c) => c.isPartner);
        }

        return {
          shopId: loaded.shopId,
          defaultGroupIds: [...defaultIds],
          filter,
          groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
          page,
          pageCount,
          limit,
          customers: list,
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
    console.error("[GET merchant/customers]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Vevők betöltése sikertelen",
      },
      { status: 500 },
    );
  }
}
