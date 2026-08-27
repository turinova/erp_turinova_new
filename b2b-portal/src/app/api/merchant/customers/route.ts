import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  mapLifetimeSpendByInnerId,
  searchShopCustomerInnerIds,
} from "@/lib/merchant/customer-spend";
import {
  getCustomerByInnerId,
  listCustomerGroups,
  listRecentCustomers,
  searchCustomers,
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

export type CustomerListFilter = "newcomers" | "partners" | "all";
export type CustomerListSort = "spent" | "-spent" | null;

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
  totalSpent: number;
};

function parseFilter(raw: string): CustomerListFilter {
  if (raw === "partners" || raw === "all") return raw;
  if (raw === "newcomers" || raw === "pending") return "newcomers";
  return "newcomers";
}

function parseSort(raw: string | null): CustomerListSort {
  if (raw === "spent" || raw === "-spent") return raw;
  return null;
}

function mapCustomer(
  c: SrCustomer,
  defaultIds: Set<number>,
  totalSpent = 0,
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
    isPartner: c.groupInnerId != null && !isDefaultGroup,
    totalSpent,
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

function sortBySpent(
  rows: MappedCustomer[],
  sort: CustomerListSort,
): MappedCustomer[] {
  if (!sort) return rows;
  const asc = sort === "spent";
  return [...rows].sort((a, b) =>
    asc ? a.totalSpent - b.totalSpent : b.totalSpent - a.totalSpent,
  );
}

/**
 * SR only pages unfiltered customers. For partners/newcomers/group we scan
 * forward until this portal page is full (cap SR pages to avoid 429).
 * When sorting by spend, collect a larger pool then sort + slice.
 */
async function listFilteredPage(opts: {
  config: Parameters<typeof listRecentCustomers>[0];
  groups: SrCustomerGroup[];
  defaultIds: Set<number>;
  filter: CustomerListFilter;
  groupInnerId: number | null;
  page: number;
  limit: number;
  sort: CustomerListSort;
}): Promise<{ customers: MappedCustomer[]; pageCount: number }> {
  const needsScan =
    opts.groupInnerId != null ||
    opts.filter === "newcomers" ||
    opts.filter === "partners";

  const poolCap = opts.sort ? Math.min(500, opts.limit * 20) : null;
  const need = poolCap ?? opts.page * opts.limit + opts.limit;

  if (!needsScan && !opts.sort) {
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

  const collected: MappedCustomer[] = [];
  let srPage = 0;
  let srPageCount = 1;
  const maxSrPages = opts.sort ? 20 : 20;
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
      if (!needsScan || matchesFilter(mapped, opts.filter, opts.groupInnerId)) {
        collected.push(mapped);
        if (collected.length >= need) break;
      }
    }
    srPage += 1;
    if (listed.customers.length === 0) break;
  }

  if (opts.sort) {
    // Spend attached later in route; return pool for enrich+sort+slice
    return { customers: collected, pageCount: 1 };
  }

  const start = opts.page * opts.limit;
  const slice = collected.slice(start, start + opts.limit);
  const exhausted = srPage >= srPageCount || srPage >= maxSrPages;
  let pageCount: number;
  if (exhausted) {
    pageCount = Math.max(1, Math.ceil(collected.length / opts.limit) || 1);
  } else {
    pageCount = Math.max(
      opts.page + 2,
      Math.ceil(collected.length / opts.limit),
    );
  }

  return { customers: slice, pageCount };
}

async function enrichSpent(
  client: Parameters<typeof mapLifetimeSpendByInnerId>[0],
  shopId: string,
  rows: MappedCustomer[],
): Promise<MappedCustomer[]> {
  const spend = await mapLifetimeSpendByInnerId(
    client,
    shopId,
    rows.map((r) => r.innerId),
  );
  return rows.map((r) => ({
    ...r,
    totalSpent: spend.get(r.innerId) ?? 0,
  }));
}

export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const filter = parseFilter(url.searchParams.get("filter") || "newcomers");
  const sort = parseSort(url.searchParams.get("sort"));
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
            limit: Math.min(50, Math.max(limit, 25)),
            groups: srGroups,
          });
          const byId = new Map<number, SrCustomer>();
          for (const c of found) byId.set(c.innerId, c);

          const localIds = await searchShopCustomerInnerIds(
            client,
            loaded.shopId,
            q,
            50,
          );
          for (const innerId of localIds) {
            if (byId.has(innerId)) continue;
            const row = await getCustomerByInnerId(loaded.config, innerId, {
              groups: srGroups,
            });
            if (row) byId.set(row.innerId, row);
          }

          let mapped = [...byId.values()].map((c) =>
            mapCustomer(c, defaultIds),
          );
          if (Number.isFinite(groupInnerId) && groupInnerId != null) {
            mapped = mapped.filter((c) => c.groupInnerId === groupInnerId);
          }
          mapped = await enrichSpent(client, loaded.shopId, mapped);
          mapped = sortBySpent(mapped, sort);
          return {
            shopId: loaded.shopId,
            defaultGroupIds: [...defaultIds],
            filter,
            sort,
            groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
            page: 0,
            pageCount: 1,
            limit,
            customers: mapped.slice(0, Math.min(50, limit)),
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
          sort,
        });

        let customers = await enrichSpent(
          client,
          loaded.shopId,
          listed.customers,
        );
        let pageCount = listed.pageCount;

        if (sort) {
          customers = sortBySpent(customers, sort);
          pageCount = Math.max(1, Math.ceil(customers.length / limit) || 1);
          const start = page * limit;
          customers = customers.slice(start, start + limit);
        }

        return {
          shopId: loaded.shopId,
          defaultGroupIds: [...defaultIds],
          filter,
          sort,
          groupInnerId: Number.isFinite(groupInnerId) ? groupInnerId : null,
          page,
          pageCount,
          limit,
          customers,
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
