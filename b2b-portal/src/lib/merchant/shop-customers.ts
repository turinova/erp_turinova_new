import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type ShopCustomerRef = {
  id: string;
  shop_id: string;
  sr_customer_inner_id: number;
  sr_customer_id: string | null;
  email: string | null;
  name_snapshot: string | null;
  sr_group_inner_id: number | null;
  sr_group_name_snapshot: string | null;
  sr_status: "active" | "missing" | "deleted";
};

export type UpsertShopCustomerInput = {
  shopId: string;
  srCustomerInnerId: number;
  srCustomerId?: string | null;
  email?: string | null;
  nameSnapshot?: string | null;
  phoneSnapshot?: string | null;
  taxNumberSnapshot?: string | null;
  srGroupInnerId?: number | null;
  srGroupNameSnapshot?: string | null;
  srStatus?: "active" | "missing" | "deleted";
};

export async function upsertShopCustomer(
  client: PoolClient,
  input: UpsertShopCustomerInput,
): Promise<ShopCustomerRef> {
  const res = await query<ShopCustomerRef>(
    client,
    `insert into shop_customers (
       shop_id, sr_customer_inner_id, sr_customer_id, email, name_snapshot,
       phone_snapshot, tax_number_snapshot, sr_group_inner_id, sr_group_name_snapshot,
       sr_status, last_seen_at, last_synced_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now(), now())
     on conflict (shop_id, sr_customer_inner_id) do update set
       sr_customer_id = coalesce(excluded.sr_customer_id, shop_customers.sr_customer_id),
       email = coalesce(excluded.email, shop_customers.email),
       name_snapshot = coalesce(excluded.name_snapshot, shop_customers.name_snapshot),
       phone_snapshot = coalesce(excluded.phone_snapshot, shop_customers.phone_snapshot),
       tax_number_snapshot = coalesce(excluded.tax_number_snapshot, shop_customers.tax_number_snapshot),
       sr_group_inner_id = coalesce(excluded.sr_group_inner_id, shop_customers.sr_group_inner_id),
       sr_group_name_snapshot = coalesce(excluded.sr_group_name_snapshot, shop_customers.sr_group_name_snapshot),
       sr_status = excluded.sr_status,
       last_seen_at = now(),
       last_synced_at = now(),
       updated_at = now()
     returning
       id, shop_id, sr_customer_inner_id, sr_customer_id, email, name_snapshot,
       sr_group_inner_id, sr_group_name_snapshot, sr_status`,
    [
      input.shopId,
      input.srCustomerInnerId,
      input.srCustomerId ?? null,
      input.email ?? null,
      input.nameSnapshot ?? null,
      input.phoneSnapshot ?? null,
      input.taxNumberSnapshot ?? null,
      input.srGroupInnerId ?? null,
      input.srGroupNameSnapshot ?? null,
      input.srStatus ?? "active",
    ],
  );
  return res.rows[0];
}

export async function recordGroupMove(
  client: PoolClient,
  input: {
    shopId: string;
    shopCustomerId: string | null;
    srCustomerInnerId: number;
    emailSnapshot?: string | null;
    fromGroupInnerId?: number | null;
    fromGroupName?: string | null;
    toGroupInnerId: number;
    toGroupName?: string | null;
    actorUserId: string;
    orgId: string;
  },
): Promise<void> {
  await query(
    client,
    `insert into shop_customer_group_moves (
       shop_id, shop_customer_id, sr_customer_inner_id, email_snapshot,
       from_group_inner_id, from_group_name, to_group_inner_id, to_group_name,
       actor_user_id
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.shopId,
      input.shopCustomerId,
      input.srCustomerInnerId,
      input.emailSnapshot ?? null,
      input.fromGroupInnerId ?? null,
      input.fromGroupName ?? null,
      input.toGroupInnerId,
      input.toGroupName ?? null,
      input.actorUserId,
    ],
  );

  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, 'customer.group_moved', $3::jsonb)`,
    [
      input.orgId,
      input.actorUserId,
      JSON.stringify({
        shopId: input.shopId,
        srCustomerInnerId: input.srCustomerInnerId,
        email: input.emailSnapshot,
        from: input.fromGroupInnerId,
        to: input.toGroupInnerId,
        toName: input.toGroupName,
      }),
    ],
  );
}

export type GroupMoveRow = {
  id: string;
  from_group_inner_id: number | null;
  from_group_name: string | null;
  to_group_inner_id: number;
  to_group_name: string | null;
  created_at: string;
};

export async function listGroupMovesForCustomer(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  limit = 20,
): Promise<GroupMoveRow[]> {
  const res = await query<GroupMoveRow>(
    client,
    `select id, from_group_inner_id, from_group_name,
            to_group_inner_id, to_group_name, created_at::text
     from shop_customer_group_moves
     where shop_id = $1 and sr_customer_inner_id = $2
     order by created_at desc
     limit $3`,
    [shopId, srCustomerInnerId, Math.min(50, Math.max(1, limit))],
  );
  return res.rows;
}

export type WidgetOrderFactRow = {
  id: string;
  gross_total: string | null;
  net_total: string | null;
  line_count: number;
  source: string;
  status: string;
  created_at: string;
};

export async function listWidgetOrdersForCustomer(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  limit = 20,
): Promise<WidgetOrderFactRow[]> {
  const res = await query<WidgetOrderFactRow>(
    client,
    `select id, gross_total::text, net_total::text, line_count, source, status,
            created_at::text
     from b2b_orders
     where shop_id = $1 and sr_customer_inner_id = $2
     order by created_at desc
     limit $3`,
    [shopId, srCustomerInnerId, Math.min(50, Math.max(1, limit))],
  );
  return res.rows;
}
