import type { PoolClient } from "pg";
import { evaluateErpQualified, loadErpQualified } from "@/lib/billing/erp-qualified";
import { parsePlanId, planFilterValues } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import {
  catalogLabel,
  computeHealth,
  isTrialActive,
  isTrialExpired,
  trialDaysLeft,
} from "@/lib/orgs/health";
import {
  sortFleet,
  type OrgAuditRow,
  type OrgDetail,
  type OrgJobRow,
  type OrgListRow,
} from "@/lib/orgs/types";

export type { OrgDetail, OrgListRow, OrgAuditRow, OrgJobRow } from "@/lib/orgs/types";
export { fleetSummary, sortFleet } from "@/lib/orgs/types";

type RawListRow = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
  plan: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
  partner_limit_override: number | null;
  sku_limit_override: number | null;
  shop_name: string | null;
  shop_status: string | null;
  widget_enabled: boolean | null;
  catalog_status: string | null;
  catalog_product_count: number | null;
  owner_email: string | null;
  last_login_at: string | null;
  invite_status: string | null;
  invite_expires_at: string | null;
  partner_limit: number | null;
  sku_limit: number | null;
  partner_used: number | null;
  job_status: string | null;
  job_created_at: string | null;
  last_order_at: string | null;
  last_ping_at: string | null;
  orders_month: number | null;
  gross_month: number | null;
};

function enrichListRow(row: RawListRow): OrgListRow {
  const plan = parsePlanId(row.plan);
  const partnerLimit = Number(row.partner_limit ?? 15);
  const partnerUsed = Number(row.partner_used ?? 0);
  const skuLimit = Number(row.sku_limit ?? 15_000);
  const skuUsed = Number(row.catalog_product_count ?? 0);
  const widgetEnabled = Boolean(row.widget_enabled);
  const { health, reason } = computeHealth({
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    widgetEnabled,
    shopStatus: row.shop_status,
    catalogStatus: row.catalog_status,
    productCount: skuUsed,
    partnerUsed,
    partnerLimit,
    skuUsed,
    skuLimit,
    jobStatus: row.job_status,
    jobCreatedAt: row.job_created_at,
    ownerLastLoginAt: row.last_login_at,
    orgCreatedAt: row.created_at,
    inviteStatus: row.invite_status,
    inviteExpiresAt: row.invite_expires_at,
  });
  const lastActivity = [row.last_order_at, row.last_login_at, row.last_ping_at]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const inviteExpired =
    row.invite_status === "pending" &&
    row.invite_expires_at != null &&
    new Date(row.invite_expires_at).getTime() <= Date.now();

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    plan,
    trial_ends_at: row.trial_ends_at,
    trialExpired: isTrialExpired(row.status, row.trial_ends_at),
    trialActive: isTrialActive(row.status, row.trial_ends_at),
    trialDaysLeft: isTrialActive(row.status, row.trial_ends_at)
      ? trialDaysLeft(row.trial_ends_at)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    shop_name: row.shop_name,
    shop_status: row.shop_status,
    widget_enabled: row.widget_enabled,
    owner_email: row.owner_email,
    invite_status: row.invite_status,
    invite_expired: inviteExpired,
    catalog_status: row.catalog_status,
    catalog_label: catalogLabel(row.catalog_status),
    product_count: skuUsed,
    partner_used: partnerUsed,
    partner_limit: partnerLimit,
    sku_used: skuUsed,
    sku_limit: skuLimit,
    overCap: partnerLimit > 0 && partnerUsed > partnerLimit,
    warn80: partnerLimit > 0 && partnerUsed / partnerLimit >= 0.8,
    health,
    healthReason: reason,
    last_activity_at: lastActivity,
    last_login_at: row.last_login_at,
    partner_limit_override: row.partner_limit_override,
    sku_limit_override: row.sku_limit_override,
    erpQualified: evaluateErpQualified({
      activePartnersMonth: partnerUsed,
      widgetOrdersMonth: Number(row.orders_month ?? 0),
      skuCount: skuUsed,
      widgetGrossMonth: Number(row.gross_month ?? 0),
    }).qualified,
  };
}

export type OrgListFilters = {
  q?: string;
  status?: string;
  plan?: string;
  health?: string;
  catalog?: string;
  widget?: string;
  flag?: string;
};

export async function listOrganizations(
  client: PoolClient,
  filters: OrgListFilters,
): Promise<OrgListRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.q) {
    clauses.push(
      `(o.name ilike $${i} or o.slug ilike $${i} or s.shoprenter_shop_name ilike $${i} or inv.email ilike $${i})`,
    );
    params.push(`%${filters.q}%`);
    i++;
  }
  if (filters.status && ["trial", "active", "suspended"].includes(filters.status)) {
    clauses.push(`o.status = $${i}`);
    params.push(filters.status);
    i++;
  }
  if (filters.plan) {
    const vals = planFilterValues(filters.plan);
    if (vals) {
      clauses.push(`o.plan = any($${i}::text[])`);
      params.push(vals);
      i++;
    }
  }

  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";

  const res = await query<RawListRow>(
    client,
    `
    select
      o.id,
      o.name,
      o.slug,
      o.status,
      o.plan,
      o.trial_ends_at,
      o.created_at,
      o.updated_at,
      o.partner_limit_override,
      o.sku_limit_override,
      s.shoprenter_shop_name as shop_name,
      s.status as shop_status,
      s.widget_enabled,
      s.catalog_status,
      s.catalog_product_count,
      s.last_ping_at,
      public.effective_partner_limit(o.id) as partner_limit,
      public.effective_sku_limit(o.id) as sku_limit,
      public.count_active_partners_month(o.id) as partner_used,
      coalesce(inv.email, mem.email) as owner_email,
      mem.last_login_at,
      inv.status as invite_status,
      inv.expires_at as invite_expires_at,
      j.status as job_status,
      j.created_at as job_created_at,
      ord.last_order_at,
      ord.orders_month,
      ord.gross_month
    from organizations o
    left join lateral (
      select
        sh.shoprenter_shop_name,
        sh.status,
        sh.widget_enabled,
        sh.catalog_status,
        (
          select count(*)::int
          from product_catalog pc
          where pc.shop_id = sh.id and pc.active
        ) as catalog_product_count,
        sh.last_ping_at
      from shops sh
      where sh.organization_id = o.id and sh.purged_at is null
      order by sh.created_at
      limit 1
    ) s on true
    left join lateral (
      select email, status, expires_at
      from invitations
      where organization_id = o.id and status = 'pending'
      order by created_at desc
      limit 1
    ) inv on true
    left join lateral (
      select u.email, u.last_login_at
      from memberships m
      join users u on u.id = m.user_id
      where m.organization_id = o.id and m.role = 'owner'
      order by m.created_at
      limit 1
    ) mem on true
    left join lateral (
      select status, created_at
      from sync_jobs
      where organization_id = o.id
      order by created_at desc
      limit 1
    ) j on true
    left join lateral (
      select
        max(bo.created_at) as last_order_at,
        count(*) filter (
          where bo.created_at >= date_trunc('month', now())
            and bo.status in ('recorded', 'linked')
        )::int as orders_month,
        coalesce(sum(coalesce(bo.gross_total, bo.net_total)) filter (
          where bo.created_at >= date_trunc('month', now())
            and bo.status in ('recorded', 'linked')
        ), 0) as gross_month
      from b2b_orders bo
      join shops sx on sx.id = bo.shop_id
      where sx.organization_id = o.id and bo.source = 'widget'
    ) ord on true
    ${where}
    `,
    params,
  );

  let rows = sortFleet(res.rows.map(enrichListRow));

  if (filters.health === "ok" || filters.health === "warn" || filters.health === "crit") {
    rows = rows.filter((r) => r.health === filters.health);
  }
  if (filters.catalog === "ready" || filters.catalog === "syncing" || filters.catalog === "error") {
    rows = rows.filter((r) => {
      if (filters.catalog === "syncing") {
        return r.catalog_status === "syncing" || r.catalog_status === "pending";
      }
      if (filters.catalog === "error") {
        return r.catalog_status === "error" || r.catalog_status === "blocked_limit";
      }
      return r.catalog_status === "ready";
    });
  }
  if (filters.widget === "on") {
    rows = rows.filter((r) => r.widget_enabled);
  }
  if (filters.widget === "off") {
    rows = rows.filter((r) => !r.widget_enabled);
  }
  if (filters.flag === "trialSoon") {
    rows = rows.filter(
      (r) => r.trialActive && r.trialDaysLeft != null && r.trialDaysLeft <= 7,
    );
  }
  if (filters.flag === "overCap") {
    rows = rows.filter((r) => r.overCap);
  }
  if (filters.flag === "erpQualified") {
    rows = rows.filter((r) => r.erpQualified);
  }

  return rows;
}

export async function getOrganizationDetail(
  client: PoolClient,
  orgId: string,
): Promise<OrgDetail | null> {
  const orgRes = await query<{
    id: string;
    name: string;
    slug: string;
    status: "trial" | "active" | "suspended";
    plan: string;
    trial_ends_at: string | null;
    created_at: string;
    updated_at: string;
    partner_limit_override: number | null;
    sku_limit_override: number | null;
  }>(client, `select * from organizations where id = $1`, [orgId]);
  const org = orgRes.rows[0];
  if (!org) return null;

  const shopRes = await query<{
    id: string;
    shoprenter_shop_name: string;
    store_url: string | null;
    public_id: string;
    status: string;
    widget_enabled: boolean;
    catalog_status: string;
    catalog_product_count: number;
    catalog_error: string | null;
    catalog_synced_at: string | null;
    last_ping_ok: boolean | null;
    last_ping_at: string | null;
    last_ping_error: string | null;
  }>(
    client,
    `select id, shoprenter_shop_name, store_url, public_id, status, widget_enabled,
            catalog_status, catalog_product_count, catalog_error, catalog_synced_at,
            last_ping_ok, last_ping_at, last_ping_error
     from shops where organization_id = $1 and purged_at is null
     order by created_at limit 1`,
    [orgId],
  );

  const inviteRes = await query<{
    id: string;
    email: string;
    expires_at: string;
    created_at: string;
  }>(
    client,
    `select id, email, expires_at, created_at from invitations
     where organization_id = $1 and status = 'pending'
     order by created_at desc limit 1`,
    [orgId],
  );

  const membersRes = await query<{
    email: string;
    role: string;
    display_name: string | null;
    last_login_at: string | null;
  }>(
    client,
    `select u.email, m.role, u.display_name, u.last_login_at
     from memberships m
     join users u on u.id = m.user_id
     where m.organization_id = $1
     order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at`,
    [orgId],
  );

  const [partnerUsedRes, partnerLimitRes, skuUsedRes, skuLimitRes, erpQualified] =
    await Promise.all([
      query<{ n: number }>(
        client,
        `select public.count_active_partners_month($1::uuid) as n`,
        [orgId],
      ),
      query<{ n: number }>(
        client,
        `select public.effective_partner_limit($1::uuid) as n`,
        [orgId],
      ),
      query<{ n: string }>(
        client,
        `select count(*)::text as n
         from product_catalog pc
         join shops s on s.id = pc.shop_id
         where s.organization_id = $1 and s.purged_at is null and pc.active`,
        [orgId],
      ),
      query<{ n: number }>(
        client,
        `select public.effective_sku_limit($1::uuid) as n`,
        [orgId],
      ),
      loadErpQualified(client, orgId),
    ]);

  const partnerUsed = Number(partnerUsedRes.rows[0]?.n ?? 0);
  const partnerLimit = Number(partnerLimitRes.rows[0]?.n ?? 15);
  const skuUsed = Number(skuUsedRes.rows[0]?.n ?? 0);
  const skuLimit = Number(skuLimitRes.rows[0]?.n ?? 15_000);
  const shop = shopRes.rows[0] ?? null;
  const owner = membersRes.rows.find((m) => m.role === "owner");
  const latestJob = await query<{
    status: string;
    created_at: string;
  }>(
    client,
    `select status, created_at from sync_jobs
     where organization_id = $1 order by created_at desc limit 1`,
    [orgId],
  );

  const { health, reason } = computeHealth({
    status: org.status,
    trialEndsAt: org.trial_ends_at,
    widgetEnabled: shop?.widget_enabled ?? false,
    shopStatus: shop?.status ?? null,
    catalogStatus: shop?.catalog_status ?? null,
    productCount: shop?.catalog_product_count ?? skuUsed,
    partnerUsed,
    partnerLimit,
    skuUsed,
    skuLimit,
    jobStatus: latestJob.rows[0]?.status ?? null,
    jobCreatedAt: latestJob.rows[0]?.created_at ?? null,
    ownerLastLoginAt: owner?.last_login_at ?? null,
    orgCreatedAt: org.created_at,
    inviteStatus: inviteRes.rows[0] ? "pending" : null,
    inviteExpiresAt: inviteRes.rows[0]?.expires_at ?? null,
  });

  const usageRes = await query<{
    orders_24h: string;
    orders_7d: string;
    orders_month: string;
    opens_24h: string;
  }>(
    client,
    `select
       (select count(*)::text from b2b_orders o
        join shops s on s.id = o.shop_id
        where s.organization_id = $1 and o.source = 'widget'
          and o.created_at >= now() - interval '24 hours') as orders_24h,
       (select count(*)::text from b2b_orders o
        join shops s on s.id = o.shop_id
        where s.organization_id = $1 and o.source = 'widget'
          and o.created_at >= now() - interval '7 days') as orders_7d,
       (select count(*)::text from b2b_orders o
        join shops s on s.id = o.shop_id
        where s.organization_id = $1 and o.source = 'widget'
          and o.created_at >= date_trunc('month', now())) as orders_month,
       (select count(*)::text from widget_opens w
        join shops s on s.id = w.shop_id
        where s.organization_id = $1
          and w.opened_at >= now() - interval '24 hours') as opens_24h`,
    [orgId],
  );

  const jobsRes = await query<OrgJobRow>(
    client,
    `select id, status, kind, pages_done, pages_total, products_upserted,
            error_message, created_at, started_at, finished_at
     from sync_jobs
     where organization_id = $1
     order by created_at desc
     limit 10`,
    [orgId],
  );

  const auditRes = await query<{
    id: string;
    action: string;
    meta: Record<string, unknown> | string;
    actor_email: string | null;
    created_at: string;
  }>(
    client,
    `select a.id, a.action, a.meta, u.email as actor_email, a.created_at
     from audit_events a
     left join users u on u.id = a.actor_user_id
     where a.organization_id = $1
     order by a.created_at desc
     limit 25`,
    [orgId],
  );

  const plan = parsePlanId(org.plan);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    plan,
    trial_ends_at: org.trial_ends_at,
    trialExpired: isTrialExpired(org.status, org.trial_ends_at),
    trialActive: isTrialActive(org.status, org.trial_ends_at),
    trialDaysLeft: isTrialActive(org.status, org.trial_ends_at)
      ? trialDaysLeft(org.trial_ends_at)
      : null,
    created_at: org.created_at,
    updated_at: org.updated_at,
    partner_limit_override: org.partner_limit_override,
    sku_limit_override: org.sku_limit_override,
    partner_used: partnerUsed,
    partner_limit: partnerLimit,
    sku_used: skuUsed,
    sku_limit: skuLimit,
    overCap: partnerLimit > 0 && partnerUsed > partnerLimit,
    warn80: partnerLimit > 0 && partnerUsed / partnerLimit >= 0.8,
    health,
    healthReason: reason,
    usage: {
      orders24h: Number(usageRes.rows[0]?.orders_24h ?? 0),
      orders7d: Number(usageRes.rows[0]?.orders_7d ?? 0),
      ordersMonth: Number(usageRes.rows[0]?.orders_month ?? 0),
      opens24h: Number(usageRes.rows[0]?.opens_24h ?? 0),
    },
    jobs: jobsRes.rows,
    audit: auditRes.rows.map((r) => ({
      id: r.id,
      action: r.action,
      meta:
        r.meta && typeof r.meta === "object"
          ? (r.meta as Record<string, unknown>)
          : {},
      actor_email: r.actor_email,
      created_at: r.created_at,
    })),
    shop: shop
      ? {
          id: shop.id,
          shoprenter_shop_name: shop.shoprenter_shop_name,
          store_url: shop.store_url,
          public_id: shop.public_id,
          status: shop.status,
          widget_enabled: shop.widget_enabled,
          catalog_status: shop.catalog_status,
          catalog_product_count: skuUsed,
          catalog_error: shop.catalog_error,
          catalog_synced_at: shop.catalog_synced_at,
          last_ping_ok: shop.last_ping_ok,
          last_ping_at: shop.last_ping_at,
          last_ping_error: shop.last_ping_error,
        }
      : null,
    pending_invite: inviteRes.rows[0] ?? null,
    members: membersRes.rows,
    erpQualified,
  };
}
