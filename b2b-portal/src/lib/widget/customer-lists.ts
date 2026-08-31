import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export const MAX_LISTS_PER_CUSTOMER = 30;
export const MAX_LINES_PER_LIST = 200;
export const MAX_LIST_NAME_LEN = 80;

export type WidgetListLine = {
  sku: string;
  quantity: number;
  productId?: string | number | null;
  name?: string | null;
};

export type WidgetListSummary = {
  id: string;
  name: string;
  lineCount: number;
  updatedAt: string;
};

export type WidgetListDetail = WidgetListSummary & {
  lines: WidgetListLine[];
  createdAt: string;
};

type ListRow = {
  id: string;
  name: string;
  lines: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function normalizeListLines(raw: unknown): WidgetListLine[] {
  if (!Array.isArray(raw)) return [];
  const out: WidgetListLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const sku = String(row.sku ?? "").trim();
    if (!sku) continue;
    const quantity = Math.max(1, Math.round(Number(row.quantity) || 1));
    const line: WidgetListLine = { sku, quantity };
    if (row.productId != null && row.productId !== "") {
      line.productId = row.productId as string | number;
    }
    if (typeof row.name === "string" && row.name.trim()) {
      line.name = row.name.trim();
    }
    out.push(line);
    if (out.length >= MAX_LINES_PER_LIST) break;
  }
  return out;
}

export function normalizeListName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_LIST_NAME_LEN) return null;
  return name;
}

function lineCount(lines: unknown): number {
  return Array.isArray(lines) ? lines.length : 0;
}

function mapSummary(row: ListRow): WidgetListSummary {
  return {
    id: row.id,
    name: row.name,
    lineCount: lineCount(row.lines),
    updatedAt: toIso(row.updated_at),
  };
}

function mapDetail(row: ListRow): WidgetListDetail {
  return {
    ...mapSummary(row),
    lines: normalizeListLines(row.lines),
    createdAt: toIso(row.created_at),
  };
}

export async function listCustomerLists(
  client: PoolClient,
  shopId: string,
  customerInnerId: number,
): Promise<WidgetListSummary[]> {
  const res = await query<ListRow>(
    client,
    `select id, name, lines, created_at, updated_at
     from widget_customer_lists
     where shop_id = $1 and customer_inner_id = $2
     order by updated_at desc
     limit $3`,
    [shopId, customerInnerId, MAX_LISTS_PER_CUSTOMER],
  );
  return res.rows.map(mapSummary);
}

export async function getCustomerList(
  client: PoolClient,
  shopId: string,
  customerInnerId: number,
  listId: string,
): Promise<WidgetListDetail | null> {
  const res = await query<ListRow>(
    client,
    `select id, name, lines, created_at, updated_at
     from widget_customer_lists
     where id = $1 and shop_id = $2 and customer_inner_id = $3
     limit 1`,
    [listId, shopId, customerInnerId],
  );
  const row = res.rows[0];
  return row ? mapDetail(row) : null;
}

export async function countCustomerLists(
  client: PoolClient,
  shopId: string,
  customerInnerId: number,
): Promise<number> {
  const res = await query<{ n: string }>(
    client,
    `select count(*)::text as n
     from widget_customer_lists
     where shop_id = $1 and customer_inner_id = $2`,
    [shopId, customerInnerId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export type CreateListResult =
  | { ok: true; list: WidgetListDetail }
  | { ok: false; error: string; status: number };

export async function createCustomerList(
  client: PoolClient,
  opts: {
    shopId: string;
    customerInnerId: number;
    name: string;
    lines: WidgetListLine[];
  },
): Promise<CreateListResult> {
  const name = normalizeListName(opts.name);
  if (!name) {
    return {
      ok: false,
      error: `A lista neve 1–${MAX_LIST_NAME_LEN} karakter legyen.`,
      status: 400,
    };
  }
  const lines = normalizeListLines(opts.lines);
  if (lines.length > MAX_LINES_PER_LIST) {
    return {
      ok: false,
      error: `Legfeljebb ${MAX_LINES_PER_LIST} tétel / lista.`,
      status: 400,
    };
  }
  const count = await countCustomerLists(
    client,
    opts.shopId,
    opts.customerInnerId,
  );
  if (count >= MAX_LISTS_PER_CUSTOMER) {
    return {
      ok: false,
      error: `Legfeljebb ${MAX_LISTS_PER_CUSTOMER} listád lehet.`,
      status: 400,
    };
  }

  try {
    const res = await query<ListRow>(
      client,
      `insert into widget_customer_lists
         (shop_id, customer_inner_id, name, lines)
       values ($1, $2, $3, $4::jsonb)
       returning id, name, lines, created_at, updated_at`,
      [
        opts.shopId,
        opts.customerInnerId,
        name,
        JSON.stringify(lines),
      ],
    );
    return { ok: true, list: mapDetail(res.rows[0]!) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("idx_widget_customer_lists_unique_name")) {
      return {
        ok: false,
        error: "Már van ilyen nevű listád. Válassz másik nevet.",
        status: 409,
      };
    }
    if (msg.includes("widget_customer_lists") && msg.includes("does not exist")) {
      return {
        ok: false,
        error: "Listák tábla hiányzik. Futtasd a sql/032_widget_customer_lists.sql fájlt.",
        status: 503,
      };
    }
    throw err;
  }
}

export type UpdateListResult =
  | { ok: true; list: WidgetListDetail }
  | { ok: false; error: string; status: number };

export async function updateCustomerList(
  client: PoolClient,
  opts: {
    shopId: string;
    customerInnerId: number;
    listId: string;
    name?: string;
    lines?: WidgetListLine[];
  },
): Promise<UpdateListResult> {
  const existing = await getCustomerList(
    client,
    opts.shopId,
    opts.customerInnerId,
    opts.listId,
  );
  if (!existing) {
    return { ok: false, error: "Lista nem található", status: 404 };
  }

  let name = existing.name;
  if (opts.name !== undefined) {
    const next = normalizeListName(opts.name);
    if (!next) {
      return {
        ok: false,
        error: `A lista neve 1–${MAX_LIST_NAME_LEN} karakter legyen.`,
        status: 400,
      };
    }
    name = next;
  }

  let lines = existing.lines;
  if (opts.lines !== undefined) {
    lines = normalizeListLines(opts.lines);
    if (lines.length > MAX_LINES_PER_LIST) {
      return {
        ok: false,
        error: `Legfeljebb ${MAX_LINES_PER_LIST} tétel / lista.`,
        status: 400,
      };
    }
  }

  try {
    const res = await query<ListRow>(
      client,
      `update widget_customer_lists
       set name = $4, lines = $5::jsonb, updated_at = now()
       where id = $1 and shop_id = $2 and customer_inner_id = $3
       returning id, name, lines, created_at, updated_at`,
      [
        opts.listId,
        opts.shopId,
        opts.customerInnerId,
        name,
        JSON.stringify(lines),
      ],
    );
    const row = res.rows[0];
    if (!row) return { ok: false, error: "Lista nem található", status: 404 };
    return { ok: true, list: mapDetail(row) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("idx_widget_customer_lists_unique_name")) {
      return {
        ok: false,
        error: "Már van ilyen nevű listád. Válassz másik nevet.",
        status: 409,
      };
    }
    throw err;
  }
}

export async function deleteCustomerList(
  client: PoolClient,
  shopId: string,
  customerInnerId: number,
  listId: string,
): Promise<boolean> {
  const res = await query(
    client,
    `delete from widget_customer_lists
     where id = $1 and shop_id = $2 and customer_inner_id = $3`,
    [listId, shopId, customerInnerId],
  );
  return (res.rowCount ?? 0) > 0;
}
