import type { PoolClient } from "pg";
import {
  defaultEmbedPricing,
  type EmbedPricingConfig,
} from "@/lib/billing/embed-pricing";
import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import { normalizeBillingStatus } from "@/lib/shoprenter/billing/recurring";

export async function loadEmbedPricingConfig(
  client: PoolClient,
): Promise<EmbedPricingConfig> {
  const fallback = defaultEmbedPricing();
  try {
    const has = await query<{ t: string | null }>(
      client,
      `select to_regclass('public.platform_settings')::text as t`,
    );
    if (!has.rows[0]?.t) return fallback;
    const s = await query<{
      trial_days: number;
      embed_monthly_list_net: number | null;
      embed_campaign_pct: number | null;
    }>(
      client,
      `select trial_days,
              embed_monthly_list_net,
              embed_campaign_pct
       from platform_settings where id = 1`,
    );
    const row = s.rows[0];
    if (!row) return fallback;
    return {
      trialDays: Number(row.trial_days) || TRIAL_DAYS_DEFAULT,
      monthlyListNet:
        row.embed_monthly_list_net != null
          ? Number(row.embed_monthly_list_net)
          : fallback.monthlyListNet,
      campaignPct:
        row.embed_campaign_pct != null
          ? Number(row.embed_campaign_pct)
          : fallback.campaignPct,
    };
  } catch {
    // Columns missing until 041.
    return fallback;
  }
}

export type OrgBillingState = {
  chargeId: string | null;
  status: string | null;
  interval: "monthly" | "annual" | null;
  updatedAt: string | null;
};

export async function getOrgBillingState(
  client: PoolClient,
  orgId: string,
): Promise<OrgBillingState> {
  try {
    const res = await query<{
      sr_recurring_charge_id: string | null;
      sr_billing_status: string | null;
      sr_billing_interval: string | null;
      sr_billing_updated_at: Date | string | null;
    }>(
      client,
      `select sr_recurring_charge_id, sr_billing_status, sr_billing_interval,
              sr_billing_updated_at
       from organizations where id = $1`,
      [orgId],
    );
    const row = res.rows[0];
    if (!row) {
      return { chargeId: null, status: null, interval: null, updatedAt: null };
    }
    const interval =
      row.sr_billing_interval === "monthly" ||
      row.sr_billing_interval === "annual"
        ? row.sr_billing_interval
        : null;
    const updated =
      row.sr_billing_updated_at instanceof Date
        ? row.sr_billing_updated_at.toISOString()
        : row.sr_billing_updated_at
          ? String(row.sr_billing_updated_at)
          : null;
    return {
      chargeId: row.sr_recurring_charge_id,
      status: normalizeBillingStatus(row.sr_billing_status),
      interval,
      updatedAt: updated,
    };
  } catch {
    return { chargeId: null, status: null, interval: null, updatedAt: null };
  }
}

export async function setOrgBillingState(
  client: PoolClient,
  orgId: string,
  opts: {
    chargeId: string | null;
    status: string | null;
    interval: "monthly" | "annual" | null;
  },
): Promise<void> {
  await query(
    client,
    `update organizations
     set sr_recurring_charge_id = $2,
         sr_billing_status = $3,
         sr_billing_interval = $4,
         sr_billing_updated_at = now(),
         updated_at = now()
     where id = $1`,
    [
      orgId,
      opts.chargeId,
      opts.status ? normalizeBillingStatus(opts.status) : null,
      opts.interval,
    ],
  );
}

/** Apply Payment API webhook / poll result to org status. */
export async function applyBillingStatusToOrg(
  client: PoolClient,
  orgId: string,
  status: string,
): Promise<void> {
  const normalized = normalizeBillingStatus(status) || status;
  await query(
    client,
    `update organizations
     set sr_billing_status = $2,
         sr_billing_updated_at = now(),
         status = case
           when $2 = 'active' then 'active'
           when $2 in ('canceled', 'declined') and status = 'active' then 'suspended'
           when $2 = 'frozen' then 'suspended'
           else status
         end,
         trial_ends_at = case
           when $2 = 'active' then null
           else trial_ends_at
         end,
         updated_at = now()
     where id = $1`,
    [orgId, normalized],
  );
}
