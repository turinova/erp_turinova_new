import type { PoolClient } from "pg";
import { isPlanId, type PlanId } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import { enqueueFullSync } from "@/lib/commerce/jobs";

export async function insertAudit(
  client: PoolClient,
  opts: {
    organizationId: string | null;
    actorUserId: string;
    action: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await query(
    client,
    `insert into audit_events (organization_id, actor_user_id, action, meta)
     values ($1, $2, $3, $4::jsonb)`,
    [
      opts.organizationId,
      opts.actorUserId,
      opts.action,
      JSON.stringify(opts.meta ?? {}),
    ],
  );
}

export type PatchOrgInput = {
  plan?: PlanId;
  status?: "trial" | "active" | "suspended";
  partnerLimitOverride?: number | null;
  skuLimitOverride?: number | null;
};

export async function patchOrganization(
  client: PoolClient,
  orgId: string,
  actorUserId: string,
  input: PatchOrgInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await query<{
    plan: string;
    status: string;
    partner_limit_override: number | null;
    sku_limit_override: number | null;
  }>(
    client,
    `select plan, status, partner_limit_override, sku_limit_override
     from organizations where id = $1`,
    [orgId],
  );
  const row = current.rows[0];
  if (!row) return { ok: false, error: "Nem található" };

  const nextPlan = input.plan && isPlanId(input.plan) ? input.plan : row.plan;
  const nextStatus = input.status ?? row.status;
  if (!["trial", "active", "suspended"].includes(nextStatus)) {
    return { ok: false, error: "Érvénytelen státusz" };
  }

  let partnerOverride = row.partner_limit_override;
  if ("partnerLimitOverride" in input) {
    const v = input.partnerLimitOverride;
    if (v != null && (!Number.isFinite(v) || v < 1)) {
      return { ok: false, error: "A vevő-limit legalább 1" };
    }
    partnerOverride = v ?? null;
  }

  let skuOverride = row.sku_limit_override;
  if ("skuLimitOverride" in input) {
    const v = input.skuLimitOverride;
    if (v != null && (!Number.isFinite(v) || v < 1)) {
      return { ok: false, error: "A termékhely-limit legalább 1" };
    }
    skuOverride = v ?? null;
  }

  await query(
    client,
    `update organizations
     set plan = $2,
         status = $3,
         partner_limit_override = $4,
         sku_limit_override = $5,
         updated_at = now()
     where id = $1`,
    [orgId, nextPlan, nextStatus, partnerOverride, skuOverride],
  );

  if (nextStatus === "suspended") {
    await query(
      client,
      `update shops set widget_enabled = false, updated_at = now()
       where organization_id = $1 and purged_at is null`,
      [orgId],
    );
  }

  await insertAudit(client, {
    organizationId: orgId,
    actorUserId,
    action: "org.patched",
    meta: {
      before: {
        plan: row.plan,
        status: row.status,
        partner_limit_override: row.partner_limit_override,
        sku_limit_override: row.sku_limit_override,
      },
      after: {
        plan: nextPlan,
        status: nextStatus,
        partner_limit_override: partnerOverride,
        sku_limit_override: skuOverride,
      },
    },
  });

  return { ok: true };
}

export async function setSessionOrg(
  client: PoolClient,
  sessionId: string,
  organizationId: string | null,
): Promise<void> {
  await query(
    client,
    `update sessions set active_organization_id = $2 where id = $1`,
    [sessionId, organizationId],
  );
}

export async function purgeShopCatalog(
  client: PoolClient,
  orgId: string,
  actorUserId: string,
  confirmName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const shop = await query<{ id: string; shoprenter_shop_name: string }>(
    client,
    `select id, shoprenter_shop_name from shops
     where organization_id = $1 and purged_at is null
     order by created_at limit 1`,
    [orgId],
  );
  const row = shop.rows[0];
  if (!row) return { ok: false, error: "Nincs bolt" };
  if (confirmName.trim().toLowerCase() !== row.shoprenter_shop_name.toLowerCase()) {
    return { ok: false, error: "A bolt neve nem egyezik" };
  }

  await query(client, `delete from product_catalog where shop_id = $1`, [row.id]);
  await query(
    client,
    `update shops
     set catalog_status = 'pending',
         catalog_product_count = 0,
         catalog_ready_at = null,
         catalog_error = null,
         updated_at = now()
     where id = $1`,
    [row.id],
  );
  await insertAudit(client, {
    organizationId: orgId,
    actorUserId,
    action: "catalog.purged",
    meta: { shopId: row.id, shop: row.shoprenter_shop_name },
  });
  return { ok: true };
}

export async function resumeCatalogAfterOverride(
  client: PoolClient,
  orgId: string,
): Promise<void> {
  const shop = await query<{ id: string; catalog_status: string }>(
    client,
    `select id, catalog_status from shops
     where organization_id = $1 and purged_at is null
     order by created_at limit 1`,
    [orgId],
  );
  const row = shop.rows[0];
  if (!row) return;
  if (row.catalog_status === "blocked_limit") {
    await enqueueFullSync(client, row.id, orgId);
  }
}
