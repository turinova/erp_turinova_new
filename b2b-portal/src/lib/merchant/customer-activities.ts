import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type ActivityKind = "done_call" | "done_email" | "done_other" | "note";

export type CustomerActivityRow = {
  id: string;
  kind: ActivityKind;
  note: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

export async function listCustomerActivities(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
  limit = 10,
): Promise<CustomerActivityRow[]> {
  const res = await query<CustomerActivityRow>(
    client,
    `select id, kind, note,
            next_follow_up_at::text,
            created_at::text
     from shop_customer_activities
     where shop_id = $1 and sr_customer_inner_id = $2
     order by created_at desc
     limit $3`,
    [shopId, srCustomerInnerId, Math.min(30, Math.max(1, limit))],
  );
  return res.rows;
}

export async function getCustomerFollowUp(
  client: PoolClient,
  shopId: string,
  srCustomerInnerId: number,
): Promise<{
  nextFollowUpAt: string | null;
  lastActivityAt: string | null;
  lastActivityKind: string | null;
} | null> {
  const res = await query<{
    next_follow_up_at: string | null;
    last_activity_at: string | null;
    last_activity_kind: string | null;
  }>(
    client,
    `select next_follow_up_at::text,
            last_activity_at::text,
            last_activity_kind
     from shop_customers
     where shop_id = $1 and sr_customer_inner_id = $2
     limit 1`,
    [shopId, srCustomerInnerId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    nextFollowUpAt: row.next_follow_up_at,
    lastActivityAt: row.last_activity_at,
    lastActivityKind: row.last_activity_kind,
  };
}

export async function recordCustomerActivity(
  client: PoolClient,
  input: {
    shopId: string;
    shopCustomerId: string | null;
    srCustomerInnerId: number;
    kind: ActivityKind;
    note?: string | null;
    nextFollowUpAt?: string | null; // YYYY-MM-DD
    actorUserId: string;
    orgId: string;
  },
): Promise<CustomerActivityRow> {
  const res = await query<CustomerActivityRow>(
    client,
    `insert into shop_customer_activities (
       shop_id, shop_customer_id, sr_customer_inner_id,
       kind, note, next_follow_up_at, actor_user_id
     ) values ($1,$2,$3,$4,$5,$6::date,$7)
     returning id, kind, note, next_follow_up_at::text, created_at::text`,
    [
      input.shopId,
      input.shopCustomerId,
      input.srCustomerInnerId,
      input.kind,
      input.note ?? null,
      input.nextFollowUpAt || null,
      input.actorUserId,
    ],
  );

  await query(
    client,
    `update shop_customers set
       next_follow_up_at = $3::date,
       last_activity_at = now(),
       last_activity_kind = $4,
       updated_at = now()
     where shop_id = $1 and sr_customer_inner_id = $2`,
    [
      input.shopId,
      input.srCustomerInnerId,
      input.nextFollowUpAt || null,
      input.kind,
    ],
  );

  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, 'customer.activity', $3::jsonb)`,
    [
      input.orgId,
      input.actorUserId,
      JSON.stringify({
        shopId: input.shopId,
        srCustomerInnerId: input.srCustomerInnerId,
        kind: input.kind,
        nextFollowUpAt: input.nextFollowUpAt,
      }),
    ],
  );

  return res.rows[0];
}
