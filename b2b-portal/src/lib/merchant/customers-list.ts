import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import {
  listRecentCustomers,
  searchCustomers,
  type SrCustomer,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";
import type { CustomerExportRow } from "@/lib/merchant/customers-xlsx";

export type CustomerListFilter = "newcomers" | "partners" | "all";

export type MappedCustomer = {
  id: string;
  innerId: number;
  email: string;
  name: string;
  groupInnerId: number | null;
  groupName: string | null;
  isDefaultGroup: boolean;
  isPartner: boolean;
};

export function parseCustomerListFilter(raw: string): CustomerListFilter {
  if (raw === "partners" || raw === "all") return raw;
  if (raw === "newcomers" || raw === "pending") return "newcomers";
  return "newcomers";
}

export function mapSrCustomer(
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
    groupInnerId: c.groupInnerId,
    groupName: c.groupName,
    isDefaultGroup,
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

/** Scan Shoprenter pages until we have enough filtered rows (or cap). */
export async function collectFilteredCustomers(opts: {
  config: ShoprenterConfig;
  groups: SrCustomerGroup[];
  defaultIds: Set<number>;
  filter: CustomerListFilter;
  groupInnerId: number | null;
  q?: string;
  maxRows?: number;
  maxSrPages?: number;
}): Promise<CustomerExportRow[]> {
  const maxRows = opts.maxRows ?? 1500;
  const maxSrPages = opts.maxSrPages ?? 40;
  const q = (opts.q || "").trim();

  if (q) {
    const found = await searchCustomers(opts.config, q, {
      limit: 50,
      groups: opts.groups,
    });
    let mapped = found.map((c) => mapSrCustomer(c, opts.defaultIds));
    if (opts.groupInnerId != null && Number.isFinite(opts.groupInnerId)) {
      mapped = mapped.filter((c) => c.groupInnerId === opts.groupInnerId);
    }
    return mapped.slice(0, maxRows).map(toExportRow);
  }

  const needsScan =
    opts.groupInnerId != null ||
    opts.filter === "newcomers" ||
    opts.filter === "partners";

  if (!needsScan) {
    const out: CustomerExportRow[] = [];
    let page = 0;
    let pageCount = 1;
    while (out.length < maxRows && page < pageCount && page < maxSrPages) {
      const listed = await listRecentCustomers(opts.config, {
        limit: 50,
        page,
        groups: opts.groups,
      });
      pageCount = Math.max(1, listed.pageCount);
      for (const row of listed.customers) {
        out.push(toExportRow(mapSrCustomer(row, opts.defaultIds)));
        if (out.length >= maxRows) break;
      }
      page += 1;
      if (listed.customers.length === 0) break;
    }
    return out;
  }

  const collected: CustomerExportRow[] = [];
  let srPage = 0;
  let srPageCount = 1;
  while (
    collected.length < maxRows &&
    srPage < srPageCount &&
    srPage < maxSrPages
  ) {
    const listed = await listRecentCustomers(opts.config, {
      limit: 50,
      page: srPage,
      groups: opts.groups,
    });
    srPageCount = Math.max(1, listed.pageCount);
    for (const row of listed.customers) {
      const mapped = mapSrCustomer(row, opts.defaultIds);
      if (matchesFilter(mapped, opts.filter, opts.groupInnerId)) {
        collected.push(toExportRow(mapped));
        if (collected.length >= maxRows) break;
      }
    }
    srPage += 1;
    if (listed.customers.length === 0) break;
  }
  return collected;
}

function toExportRow(c: MappedCustomer): CustomerExportRow {
  return {
    email: c.email,
    name: c.name,
    groupName: c.groupName || "",
    groupInnerId: c.groupInnerId,
    innerId: c.innerId,
  };
}
