/** Launch plans v6 — base + optional Turinova-mark removal.
 * start = Gyors rendelés (base, mark visible)
 * plus / pro = same product + white-label (mark hideable when paid)
 * Partner limit is soft infra (high) — not the sales pitch.
 * Alias: grow→plus, scale→pro.
 */

export const PLAN_IDS = ["start", "plus", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Base subscription (bruttó Ft / hó) — Turinova felirat látszik. */
export const BASE_PRICE_HUF = 7_500;
/** Add-on: hide Turinova mark on the widget (bruttó). */
export const MARK_ADDON_HUF = 2_499;
/** Saját márka összesen (7500 + 2499), bruttó. */
export const WHITE_LABEL_PRICE_HUF = BASE_PRICE_HUF + MARK_ADDON_HUF; // 9_999

/** Soft cap — not marketed; avoids blur for normal B2B volume. */
export const SOFT_PARTNER_LIMIT = 500;
export const SOFT_SKU_LIMIT = 80_000;

export const PLAN_DEFAULTS: Record<
  PlanId,
  { partnerLimit: number; skuLimit: number; listPriceHuf: number; label: string }
> = {
  start: {
    partnerLimit: SOFT_PARTNER_LIMIT,
    skuLimit: SOFT_SKU_LIMIT,
    listPriceHuf: BASE_PRICE_HUF,
    label: "Gyors rendelés",
  },
  plus: {
    partnerLimit: SOFT_PARTNER_LIMIT,
    skuLimit: SOFT_SKU_LIMIT,
    listPriceHuf: WHITE_LABEL_PRICE_HUF,
    label: "Saját márka",
  },
  pro: {
    partnerLimit: SOFT_PARTNER_LIMIT,
    skuLimit: SOFT_SKU_LIMIT,
    listPriceHuf: WHITE_LABEL_PRICE_HUF,
    label: "Saját márka (Pro)",
  },
};

export const TRIAL_DAYS_DEFAULT = 14;

/** Default paid plan after trial / recommended buy. */
export const RECOMMENDED_PLAN: PlanId = "start";

/** Plans shown on merchant pricing UI (pro aliases plus for white-label). */
export const MERCHANT_PLAN_IDS = ["start", "plus"] as const;

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

export function isKnownPlanInput(v: string): boolean {
  return isPlanId(v) || v === "grow" || v === "scale" || v === "starter";
}

export function planFilterValues(raw: string): string[] | null {
  if (!isKnownPlanInput(raw)) return null;
  const id = parsePlanId(raw);
  /* Admin „Felirat nélkül” = plus + pro (white-label). */
  if (id === "plus" || id === "pro") return ["plus", "grow", "pro", "scale"];
  return ["start", "starter"];
}

/** True if this plan includes paid white-label (mark may be hidden). */
export function hasWhiteLabel(plan: PlanId): boolean {
  return plan === "plus" || plan === "pro";
}

/** Widget mark may be hidden only on paid white-label — never during trial. */
export function canHideTurinovaMark(plan: PlanId, isTrial: boolean): boolean {
  return !isTrial && hasWhiteLabel(plan);
}

/** Photo→list: always on. */
export function canParseImage(_plan: PlanId, _isTrial: boolean): boolean {
  return true;
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

/** Előfizetés listára — mindig bruttó (ÁFÁS). */
export function formatPlanPrice(n: number): string {
  return `${formatHuf(n)} bruttó`;
}

export function formatTrialEnd(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function onPlan(label: string): string {
  const l = label.trim();
  if (!l) return "a csomagon";
  if (/[aeiouáéíóöőúüű]$/i.test(l)) return `a ${l}n`;
  return `a ${l}on`;
}

export function upgradeMailto(opts: {
  plan: PlanId;
  shopName?: string | null;
  annual?: boolean;
}): string {
  const label = PLAN_DEFAULTS[opts.plan].label;
  const period = opts.annual ? "éves" : "havi";
  const shop = opts.shopName?.trim() ? ` (${opts.shopName.trim()})` : "";
  const subject = encodeURIComponent(
    `Turinova B2B — ${label}, ${period}${shop}`,
  );
  return `mailto:hello@turinova.hu?subject=${subject}`;
}
