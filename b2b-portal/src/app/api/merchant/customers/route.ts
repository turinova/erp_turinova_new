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
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type CustomerListFilter = "newcomers" | "partners" | "all";

type MappedCustomer = {
  id: string;
  innerId: number;
  email: string;
  name: string;
  telephone: string | null;
  approved: boolean;
  dateCreated: string | null;
  groupInnerId: number | null;
  groupName: string | null;
  isDefaultGroup: boolean;
  isPartner: boolean;
};

function parseFilter(raw: string): CustomerListFilter {
  if (raw === "partners" || raw === "all") return raw;
  if (raw === "newcomers" || raw === "pending") return "newcomers";
  return "newcomers";
}

function mapCustomer(
  c: SrCustomer,
  defaultIds: Set<number>,
): MappedCustomer {
  const isDefaultGroup =
    c.groupInnerId != null && defaultIds.has(c.groupInnerId);
  return {
    id: c.id,
    innerId: c.innerId,
    email: c.email,
    name:
      [c.lastname, c.firstname].filter(Boolean).join(" ").trim() || c.email,
    telephone: c.telephone,
    approved: c.approved,
    dateCreated: c.dateCreated,
    groupInnerId: c.groupInnerId,
    groupName: c.groupName,
    isDefaultGroup,
    /** Partner = nem az alap csoportban */
    isPartner: c.groupInnerId != null && !isDefaultGroup,
  };
}

function matchesFilter(
  c: MappedCustomer,
  filter: CustomerListFilter,
  groupInnerId: number | null,
): boolean {
  if (groupInnerId != null && Number.isFinite(groupInnerId)) {
    return c.groupInnerId === groupInnerId;
  }
  if (filter === "newcomers") return c.isDefaultGroup;
  if (filter === "partners") return c.isPartner;
  return true;
}

/**
 * SR only pages unfiltered customers. For partners/newcomers/group we scan
 * forward until this portal page is full (cap SR pages to avoid 429).
 */
async function listFilteredPage(opts: {
  config: Parameters<typeof listRecentCustomers>[0];
  groups: SrCustomerGroup[];
  defaultIds: Set<number>;
  filter: CustomerListFilter;
  groupInnerId: number | null;
  page: number;
  limit: number;
}): Promise<{ customers: MappedCustomer[]; pageCount: number }> {
  const needsScan =
    opts.groupInnerId != null ||
    opts.filter === "newcomers" ||
    opts.filter === "partners";

  if (!needsScan) {
    const listed = await listRecentCustomers(opts.config, {
      limit: opts.limit,
      page: opts.page,
      groups: opts.groups,
    });
    return {
      customers: listed.customers.map((c) =>
        mapCustomer(c, opts.defaultIds),
      ),
      pageCount: listed.pageCount,
    };
  }

  const need = opts.page * opts.limit + opts.limit;
  const collected: MappedCustomer[] = [];
  let srPage = 0;
  let srPageCount = 1;
  const maxSrPages = 20;
  const srLimit = 50;

  while (
    collected.length < need &&
    srPage < srPageCount &&
    srPage < maxSrPages
  ) {
    const listed = await listRecentCustomers(opts.config, {
      limit: srLimit,
      page: srPage,
      groups: opts.groups,
    });
    srPageCount = Math.max(1, listed.pageCount);
    for (const row of listed.customers) {
      const mapped = mapCustomer(row, opts.defaultIds);
      if (matchesFilter(mapped, opts.filter, opts.groupInnerId)) {
        collected.push(mapped);
      }
    }
    srPage += 1;
    if (listed.customers.length === 0) break;
  }

  const start = opts.page * opts.limit;
  const slice = collected.slice(start, start + opts.limit);
  const exhausted = srPage >= srPageCount || srPage >= maxSrPages;
  let pageCount: number;
  if (exhausted) {
    pageCount = Math.max(1, Math.ceil(collected.length / opts.limit) || 1);
  } else {
    // More SR pages exist → at least one more portal page after current fill
    pageCount = Math.max(opts.page + 2, Math.ceil(collected.length / opts.limit));
  }

  return { customers: slice, pageCount };
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

        const srGroups = await listCustomerGroups(loaded.config);
        const defaultIds = new Set(
          srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
        );

        if (q) {
          const found = await searchCustomers(loaded.config, q, {
            limit: Math.min(50, limit),
            groups: srGroups,
          });
          // Search ignores tab filter — merchant looks up by name/email across all.
          let mapped = found.map((c) => mapCustomer(c, defaultIds));
          if (Number.isFinite(groupInnerId) && groupInnerId != null) {
            mapped = mapped.filter((c) => c.groupInnerId === groupInnerId);
          }
          return {
            shopId: loaded.shopId,
            defaultGroupIds: [...defaultIds],
            filter,
            groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
            page: 0,
            pageCount: 1,
            limit,
            customers: mapped,
          };
        }

        const listed = await listFilteredPage({
          config: loaded.config,
          groups: srGroups,
          defaultIds,
          filter,
          groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
          page,
          limit,
        });

        return {
          shopId: loaded.shopId,
          defaultGroupIds: [...defaultIds],
          filter,
          groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
          page,
          pageCount: listed.pageCount,
          limit,
          customers: listed.customers,
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
