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
  companySnapshot?: string | null;
  srGroupInnerId?: number | null;
  srGroupNameSnapshot?: string | null;
  srStatus?: "active" | "missing" | "deleted";
  approved?: boolean | null;
  dateCreatedSr?: string | null;
};

export async function upsertShopCustomer(
  client: PoolClient,
  input: UpsertShopCustomerInput,
): Promise<ShopCustomerRef> {
  // Try extended mirror columns (039); fall back if migration not applied.
  try {
    const res = await query<ShopCustomerRef>(
      client,
      `insert into shop_customers (
         shop_id, sr_customer_inner_id, sr_customer_id, email, name_snapshot,
         phone_snapshot, tax_number_snapshot, company_snapshot,
         sr_group_inner_id, sr_group_name_snapshot,
         sr_status, approved, date_created_sr, last_seen_at, last_synced_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz, now(), now())
       on conflict (shop_id, sr_customer_inner_id) do update set
         sr_customer_id = coalesce(excluded.sr_customer_id, shop_customers.sr_customer_id),
         email = coalesce(excluded.email, shop_customers.email),
         name_snapshot = coalesce(excluded.name_snapshot, shop_customers.name_snapshot),
         phone_snapshot = coalesce(excluded.phone_snapshot, shop_customers.phone_snapshot),
         tax_number_snapshot = coalesce(excluded.tax_number_snapshot, shop_customers.tax_number_snapshot),
         company_snapshot = coalesce(excluded.company_snapshot, shop_customers.company_snapshot),
         sr_group_inner_id = coalesce(excluded.sr_group_inner_id, shop_customers.sr_group_inner_id),
         sr_group_name_snapshot = coalesce(excluded.sr_group_name_snapshot, shop_customers.sr_group_name_snapshot),
         sr_status = excluded.sr_status,
         approved = coalesce(excluded.approved, shop_customers.approved),
         date_created_sr = coalesce(excluded.date_created_sr, shop_customers.date_created_sr),
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
        input.companySnapshot ?? null,
        input.srGroupInnerId ?? null,
        input.srGroupNameSnapshot ?? null,
        input.srStatus ?? "active",
        input.approved ?? null,
        input.dateCreatedSr ?? null,
      ],
    );
    return res.rows[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/company_snapshot|approved|date_created_sr/i.test(msg)) throw err;
  }

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

export async function getSkipAutoGroupMove(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
): Promise<boolean> {
  const res = await query<{ skip_auto_group_move: boolean }>(
    client,
    `select skip_auto_group_move from shop_customers
     where shop_id = $1 and sr_customer_inner_id = $2`,
    [shopId, srCustomerInnerId],
  );
  return Boolean(res.rows[0]?.skip_auto_group_move);
}

export async function setSkipAutoGroupMove(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  skip: boolean,
): Promise<boolean> {
  const res = await query<{ skip_auto_group_move: boolean }>(
    client,
    `update shop_customers
     set skip_auto_group_move = $3, updated_at = now()
     where shop_id = $1 and sr_customer_inner_id = $2
     returning skip_auto_group_move`,
    [shopId, srCustomerInnerId, skip],
  );
  return Boolean(res.rows[0]?.skip_auto_group_move);
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
    actorUserId: string | null;
    orgId: string;
    source?: "manual" | "system" | "rule";
    ruleId?: string | null;
    reason?: string | null;
    metric?: string | null;
    metricValue?: number | null;
    threshold?: number | null;
    period?: string | null;
    direction?: "up" | "down" | null;
  },
): Promise<void> {
  const source = input.source ?? "manual";
  try {
    await query(
      client,
      `insert into shop_customer_group_moves (
         shop_id, shop_customer_id, sr_customer_inner_id, email_snapshot,
         from_group_inner_id, from_group_name, to_group_inner_id, to_group_name,
         actor_user_id, source, rule_id, reason,
         metric, metric_value, threshold, period, direction
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
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
        source,
        input.ruleId ?? null,
        input.reason ?? null,
        input.metric ?? null,
        input.metricValue ?? null,
        input.threshold ?? null,
        input.period ?? null,
        input.direction ?? null,
      ],
    );
  } catch {
    try {
      await query(
        client,
        `insert into shop_customer_group_moves (
           shop_id, shop_customer_id, sr_customer_inner_id, email_snapshot,
           from_group_inner_id, from_group_name, to_group_inner_id, to_group_name,
           actor_user_id, source, rule_id, reason
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
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
          source,
          input.ruleId ?? null,
          input.reason ?? null,
        ],
      );
    } catch {
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
    }
  }

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
        source,
        ruleId: input.ruleId ?? null,
        reason: input.reason ?? null,
        metric: input.metric ?? null,
        metricValue: input.metricValue ?? null,
        threshold: input.threshold ?? null,
        period: input.period ?? null,
        direction: input.direction ?? null,
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
  source?: string | null;
  reason?: string | null;
  metric?: string | null;
  metric_value?: string | null;
  threshold?: string | null;
  period?: string | null;
  direction?: string | null;
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
            to_group_inner_id, to_group_name, created_at::text,
            source, reason, metric, metric_value::text, threshold::text,
            period, direction
     from shop_customer_group_moves
     where shop_id = $1 and sr_customer_inner_id = $2
     order by created_at desc
     limit $3`,
    [shopId, srCustomerInnerId, Math.min(50, Math.max(1, limit))],
  );
  return res.rows;
}

export async function listRecentSystemGroupMoves(
  client: PoolClient,
  shopId: string,
  limit = 20,
): Promise<
  Array<
    GroupMoveRow & {
      email_snapshot: string | null;
      sr_customer_inner_id: number;
    }
  >
> {
  const res = await query<
    GroupMoveRow & {
      email_snapshot: string | null;
      sr_customer_inner_id: number;
    }
  >(
    client,
    `select id, from_group_inner_id, from_group_name,
            to_group_inner_id, to_group_name, created_at::text,
            source, reason, email_snapshot, sr_customer_inner_id,
            metric, metric_value::text, threshold::text, period, direction
     from shop_customer_group_moves
     where shop_id = $1
       and coalesce(source, 'manual') in ('system', 'rule', 'manual')
     order by created_at desc
     limit $2`,
    [shopId, Math.min(100, Math.max(1, limit))],
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
