import type { PlanId } from "@/lib/billing/plans";
import type { ErpQualified } from "@/lib/billing/erp-qualified";
import type { HealthLevel } from "@/lib/orgs/health";

export type OrgListRow = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
  plan: PlanId;
  trial_ends_at: string | null;
  trialExpired: boolean;
  trialActive: boolean;
  trialDaysLeft: number | null;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  shop_status: string | null;
  widget_enabled: boolean | null;
  owner_email: string | null;
  invite_status: string | null;
  invite_expired: boolean;
  catalog_status: string | null;
  catalog_label: string;
  product_count: number;
  partner_used: number;
  partner_limit: number;
  sku_used: number;
  sku_limit: number;
  overCap: boolean;
  warn80: boolean;
  health: HealthLevel;
  healthReason: string;
  last_activity_at: string | null;
  last_login_at: string | null;
  partner_limit_override: number | null;
  sku_limit_override: number | null;
  erpQualified: boolean;
};

export type OrgAuditRow = {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  actor_email: string | null;
  created_at: string;
};

export type OrgJobRow = {
  id: string;
  status: string;
  kind: string;
  pages_done: number;
  pages_total: number | null;
  products_upserted: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type OrgUsage = {
  orders24h: number;
  orders7d: number;
  ordersMonth: number;
  opens24h: number;
};

export type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
  plan: PlanId;
  trial_ends_at: string | null;
  trialExpired: boolean;
  trialActive: boolean;
  trialDaysLeft: number | null;
  created_at: string;
  updated_at: string;
  partner_limit_override: number | null;
  sku_limit_override: number | null;
  partner_used: number;
  partner_limit: number;
  sku_used: number;
  sku_limit: number;
  overCap: boolean;
  warn80: boolean;
  health: HealthLevel;
  healthReason: string;
  usage: OrgUsage;
  jobs: OrgJobRow[];
  audit: OrgAuditRow[];
  shop: {
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
  } | null;
  pending_invite: {
    id: string;
    email: string;
    expires_at: string;
    created_at: string;
  } | null;
  members: Array<{
    email: string;
    role: string;
    display_name: string | null;
    last_login_at: string | null;
  }>;
  erpQualified: ErpQualified;
};

const HEALTH_RANK: Record<HealthLevel, number> = { crit: 0, warn: 1, ok: 2 };

export function sortFleet(rows: OrgListRow[]): OrgListRow[] {
  return [...rows].sort((a, b) => {
    const hr = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
    if (hr !== 0) return hr;
    const ad = a.trialDaysLeft ?? 9999;
    const bd = b.trialDaysLeft ?? 9999;
    if (a.trialActive && b.trialActive && ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name, "hu");
  });
}

export function fleetSummary(rows: OrgListRow[]): {
  crit: number;
  warn: number;
  trialSoon: number;
  overCap: number;
  erpQualified: number;
} {
  return {
    crit: rows.filter((r) => r.health === "crit").length,
    warn: rows.filter((r) => r.health === "warn").length,
    trialSoon: rows.filter(
      (r) => r.trialActive && r.trialDaysLeft != null && r.trialDaysLeft <= 7,
    ).length,
    overCap: rows.filter((r) => r.overCap).length,
    erpQualified: rows.filter((r) => r.erpQualified).length,
  };
}
