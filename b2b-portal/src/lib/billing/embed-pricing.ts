/**
 * App Store embed pricing SoT (nettó Ft).
 * Campaign % / list price can be overridden from platform_settings (041).
 */

import { TRIAL_DAYS_DEFAULT, formatHuf } from "@/lib/billing/plans";

/** List nettó / hó (embed kampány alap). */
export const EMBED_MONTHLY_LIST_NET = 9_999;

/** Induló kedvezmény % (havi és éves). */
export const EMBED_CAMPAIGN_PCT_DEFAULT = 27;

export type EmbedPricingConfig = {
  monthlyListNet: number;
  campaignPct: number;
  trialDays: number;
};

export function defaultEmbedPricing(): EmbedPricingConfig {
  return {
    monthlyListNet: EMBED_MONTHLY_LIST_NET,
    campaignPct: EMBED_CAMPAIGN_PCT_DEFAULT,
    trialDays: TRIAL_DAYS_DEFAULT,
  };
}

export function dealNet(listNet: number, campaignPct: number): number {
  const pct = Math.min(90, Math.max(0, campaignPct));
  return Math.round(listNet * (1 - pct / 100));
}

export function annualListNet(monthlyListNet: number): number {
  return monthlyListNet * 12;
}

export function formatEmbedPrice(n: number): string {
  return formatHuf(n);
}

/** Shoprenter Payment API env gate. */
export function isAppStoreBillingEnabled(): boolean {
  return (
    (process.env.SR_BILLING_ENABLED || "").trim() === "1" &&
    Boolean(process.env.SR_PLAN_ID_MONTHLY?.trim()) &&
    Boolean(process.env.SR_PLAN_ID_ANNUAL?.trim())
  );
}

export function appStorePlanId(annual: boolean): string | null {
  const id = annual
    ? process.env.SR_PLAN_ID_ANNUAL?.trim()
    : process.env.SR_PLAN_ID_MONTHLY?.trim();
  return id || null;
}
