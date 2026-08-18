/** Launch plans — mirrors sql/015_org_stats_and_limits.sql */

export const PLAN_IDS = ["start", "grow", "pro", "scale"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_DEFAULTS: Record<
  PlanId,
  { partnerLimit: number; skuLimit: number; listPriceHuf: number; label: string }
> = {
  start: { partnerLimit: 15, skuLimit: 15_000, listPriceHuf: 14_900, label: "Start" },
  grow: { partnerLimit: 30, skuLimit: 40_000, listPriceHuf: 34_900, label: "Grow" },
  pro: { partnerLimit: 80, skuLimit: 80_000, listPriceHuf: 69_900, label: "Pro" },
  scale: { partnerLimit: 200, skuLimit: 150_000, listPriceHuf: 139_900, label: "Scale" },
};

export const TRIAL_DAYS_DEFAULT = 30;

export function isPlanId(v: string): v is PlanId {
  return (PLAN_IDS as readonly string[]).includes(v);
}

export function parsePlanId(v: unknown, fallback: PlanId = "start"): PlanId {
  if (typeof v === "string" && isPlanId(v)) return v;
  if (v === "starter") return "start";
  return fallback;
}
