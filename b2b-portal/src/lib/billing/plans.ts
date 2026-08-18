/** Launch plans — mirrors sql/019_plans_v3.sql (kézi). Alias: grow→plus, scale→pro. */

export const PLAN_IDS = ["start", "plus", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_DEFAULTS: Record<
  PlanId,
  { partnerLimit: number; skuLimit: number; listPriceHuf: number; label: string }
> = {
  start: { partnerLimit: 15, skuLimit: 15_000, listPriceHuf: 6_900, label: "Start" },
  plus: { partnerLimit: 40, skuLimit: 40_000, listPriceHuf: 12_900, label: "Plus" },
  pro: { partnerLimit: 120, skuLimit: 80_000, listPriceHuf: 24_900, label: "Pro" },
};

export const TRIAL_DAYS_DEFAULT = 30;

export const RECOMMENDED_PLAN: PlanId = "plus";

export function isPlanId(v: string): v is PlanId {
  return (PLAN_IDS as readonly string[]).includes(v);
}

export function parsePlanId(v: unknown, fallback: PlanId = "start"): PlanId {
  if (typeof v !== "string") return fallback;
  if (v === "grow") return "plus";
  if (v === "scale") return "pro";
  if (v === "starter") return "start";
  if (isPlanId(v)) return v;
  return fallback;
}

/** Admin filter / PATCH: canonical + legacy aliases until SQL 019 is applied. */
export function isKnownPlanInput(v: string): boolean {
  return isPlanId(v) || v === "grow" || v === "scale" || v === "starter";
}

export function planFilterValues(raw: string): string[] | null {
  if (!isKnownPlanInput(raw)) return null;
  const id = parsePlanId(raw);
  if (id === "plus") return ["plus", "grow"];
  if (id === "pro") return ["pro", "scale"];
  return ["start", "starter"];
}

/** Widget storefront mark may be hidden only on paid Pro — never during trial. */
export function canHideTurinovaMark(plan: PlanId, isTrial: boolean): boolean {
  return !isTrial && plan === "pro";
}

/** Photo→list: trial or paid Pro. Buyer never sees upgrade copy. */
export function canParseImage(plan: PlanId, isTrial: boolean): boolean {
  return isTrial || plan === "pro";
}

export function resolveShowTurinovaMark(opts: {
  hideRequested: boolean;
  plan: PlanId;
  isTrial: boolean;
}): boolean {
  if (!canHideTurinovaMark(opts.plan, opts.isTrial)) return true;
  return !opts.hideRequested;
}

/** 10× monthly = 2 months free. */
export function annualPriceHuf(plan: PlanId): number {
  return PLAN_DEFAULTS[plan].listPriceHuf * 10;
}

export function formatHuf(n: number): string {
  return `${n.toLocaleString("hu-HU")} Ft`;
}

/** „a Pluson”, „a Starton”, „a Pron” — ne Plusen / Starten. */
export function onPlan(label: string): string {
  return `a ${label}on`;
}

export function upgradeMailto(opts: {
  plan: PlanId;
  shopName?: string | null;
  annual?: boolean;
}): string {
  const label = PLAN_DEFAULTS[opts.plan].label;
  const shop = opts.shopName?.trim() || "bolt";
  const subject = opts.annual
    ? `${label} éves kellene — ${shop}`
    : `${label} kellene — ${shop}`;
  return `mailto:hello@turinova.hu?subject=${encodeURIComponent(subject)}`;
}
