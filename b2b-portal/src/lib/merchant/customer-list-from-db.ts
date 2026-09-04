/**
 * Vevőlista shop_customers tükörből — Partnerek / Újak teljes lapozás
 * (Shoprenter scan limit nélkül).
 */

import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type MirrorListFilter = "newcomers" | "partners" | "all";
export type MirrorListSort = "spent" | "-spent" | null;

export type MirrorCustomerRow = {
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

type DbRow = {
  id: string;
  sr_customer_inner_id: number;
  email: string | null;
  name_snapshot: string | null;
  phone_snapshot: string | null;
  sr_group_inner_id: number | null;
  sr_group_name_snapshot: string | null;
  approved: boolean | null;
  date_created_sr: string | null;
  total_spent: string | number | null;
};

function mapRow(
  row: DbRow,
  defaultIds: Set<number>,
  groupNameById: Map<number, string>,
): MirrorCustomerRow {
  const groupInnerId = row.sr_group_inner_id;
  const isDefaultGroup =
    groupInnerId != null && defaultIds.has(groupInnerId);
  const email = (row.email || "").trim();
  const name =
    (row.name_snapshot || "").trim() || email || `Vevő #${row.sr_customer_inner_id}`;
  return {
    id: row.id,
    innerId: row.sr_customer_inner_id,
    email,
    name,
    telephone: row.phone_snapshot,
    approved: row.approved !== false,
    dateCreated: row.date_created_sr,
    groupInnerId,
    groupName:
      row.sr_group_name_snapshot ||
      (groupInnerId != null ? groupNameById.get(groupInnerId) ?? null : null),
    isDefaultGroup,
    isPartner: groupInnerId != null && !isDefaultGroup,
    totalSpent: Math.round(Number(row.total_spent) || 0),
  };
}

function buildWhere(opts: {
  filter: MirrorListFilter;
  groupInnerId: number | null;
  defaultIds: number[];
  q?: string;
}): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const parts: string[] = ["c.shop_id = $1", "c.sr_status = 'active'"];
  params.push(null); // placeholder for shopId at [0] — filled by caller

  if (opts.groupInnerId != null && Number.isFinite(opts.groupInnerId)) {
    params.push(opts.groupInnerId);
    parts.push(`c.sr_group_inner_id = $${params.length}`);
  } else if (opts.filter === "partners") {
    if (opts.defaultIds.length > 0) {
      params.push(opts.defaultIds);
      parts.push(
        `c.sr_group_inner_id is not null and not (c.sr_group_inner_id = any($${params.length}::int[]))`,
      );
    } else {
      parts.push(`c.sr_group_inner_id is not null`);
    }
  } else if (opts.filter === "newcomers") {
    if (opts.defaultIds.length > 0) {
      params.push(opts.defaultIds);
      parts.push(
        `(c.sr_group_inner_id is null or c.sr_group_inner_id = any($${params.length}::int[]))`,
      );
    } else {
      parts.push(`c.sr_group_inner_id is null`);
    }
  }

  const needle = opts.q?.trim();
  if (needle) {
    params.push(needle);
    parts.push(
      `(c.email ilike '%' || $${params.length} || '%' or coalesce(c.name_snapshot, '') ilike '%' || $${params.length} || '%')`,
    );
  }

  return { sql: parts.join(" and "), params };
}

/**
 * @returns null if shop_customers missing / unusable → caller falls back to SR.
 */
export async function listCustomersFromMirror(
  client: PoolClient,
  shopId: string,
  opts: {
    filter: MirrorListFilter;
    groupInnerId: number | null;
    defaultGroupIds: number[];
    groupNameById?: Map<number, string>;
    page: number;
    limit: number;
    sort: MirrorListSort;
    q?: string;
  },
): Promise<{
  customers: MirrorCustomerRow[];
  pageCount: number;
  total: number;
  source: "db";
} | null> {
  const defaultIds = [...new Set(opts.defaultGroupIds.filter((n) => n > 0))];
  const page = Math.max(0, opts.page);
  const limit = Math.min(50, Math.max(1, opts.limit));
  const offset = page * limit;
  const groupNameById = opts.groupNameById ?? new Map<number, string>();

  const where = buildWhere({
    filter: opts.filter,
    groupInnerId: opts.groupInnerId,
    defaultIds,
    q: opts.q,
  });
  where.params[0] = shopId;

  try {
    const countRes = await query<{ n: string }>(
      client,
      `select count(*)::text as n
         from shop_customers c
        where ${where.sql}`,
      where.params,
    );
    const total = Math.max(0, Number(countRes.rows[0]?.n || 0));
    if (total === 0) return null;

    const orderSql =
      opts.sort === "spent"
        ? "coalesce(spend.spent, 0) asc, c.last_seen_at desc nulls last"
        : opts.sort === "-spent"
          ? "coalesce(spend.spent, 0) desc, c.last_seen_at desc nulls last"
          : "c.last_seen_at desc nulls last, c.sr_customer_inner_id desc";

    const limitIdx = where.params.length + 1;
    const offsetIdx = where.params.length + 2;
    const listParams = [...where.params, limit, offset];

    // Prefer columns from 039; fall back if migration not applied.
    let rows: DbRow[];
    try {
      const listRes = await query<DbRow>(
        client,
        `select c.id,
                c.sr_customer_inner_id,
                c.email,
                c.name_snapshot,
                c.phone_snapshot,
                c.sr_group_inner_id,
                c.sr_group_name_snapshot,
                c.approved,
                c.date_created_sr::text as date_created_sr,
                coalesce(spend.spent, 0) as total_spent
           from shop_customers c
           left join (
             select sr_customer_inner_id, sum(total_gross) as spent
               from shop_order_facts
              where shop_id = $1
                and sr_customer_inner_id is not null
              group by sr_customer_inner_id
           ) spend on spend.sr_customer_inner_id = c.sr_customer_inner_id
          where ${where.sql}
          order by ${orderSql}
          limit $${limitIdx} offset $${offsetIdx}`,
        listParams,
      );
      rows = listRes.rows;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/approved|date_created_sr|shop_order_facts/i.test(msg)) throw err;

      const listRes = await query<DbRow>(
        client,
        `select c.id,
                c.sr_customer_inner_id,
                c.email,
                c.name_snapshot,
                c.phone_snapshot,
                c.sr_group_inner_id,
                c.sr_group_name_snapshot,
                null::boolean as approved,
                null::text as date_created_sr,
                0::numeric as total_spent
           from shop_customers c
          where ${where.sql}
          order by c.last_seen_at desc nulls last, c.sr_customer_inner_id desc
          limit $${limitIdx} offset $${offsetIdx}`,
        listParams,
      );
      rows = listRes.rows;
    }

    const customers = rows.map((r) =>
      mapRow(r, new Set(defaultIds), groupNameById),
    );
    const pageCount = Math.max(1, Math.ceil(total / limit));

    return { customers, pageCount, total, source: "db" };
  } catch (err) {
    console.warn("[customer-list-from-db] listCustomersFromMirror", err);
    return null;
  }
}

/** True if shop_customers has any active rows for this shop. */
export async function shopCustomersMirrorReady(
  client: PoolClient,
  shopId: string,
): Promise<boolean> {
  try {
    const res = await query<{ ok: number }>(
      client,
      `select 1::int as ok
         from shop_customers
        where shop_id = $1 and sr_status = 'active'
        limit 1`,
      [shopId],
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}
