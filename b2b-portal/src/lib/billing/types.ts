import { PLAN_DEFAULTS, type PlanId, upgradeMailto } from "@/lib/billing/plans";

export type PartnerGateDto = {
  activePartners: number;
  partnerLimit: number;
  paidPartnerLimit: number;
  overCap: boolean;
  warn80: boolean;
  wouldLoseOnPaid: boolean;
  visibleInnerIds: number[];
  /** Trial preview: top-N on the post-trial plan. Still editable. */
  paidVisibleInnerIds: number[];
  plan: PlanId;
  planLabel: string;
  isTrial: boolean;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
};

export const UPGRADE_MAILTO = upgradeMailto({ plan: "plus" });

export function isPartnerLocked(
  isPartner: boolean | undefined,
  innerId: number,
  gate: PartnerGateDto | null,
): boolean {
  if (!gate?.overCap || !isPartner) return false;
  return !gate.visibleInnerIds.includes(innerId);
}

/** Visual only during trial: would drop off the paid top-N. */
export function isPartnerPreviewLocked(
  isPartner: boolean | undefined,
  innerId: number,
  gate: PartnerGateDto | null,
): boolean {
  if (!gate?.wouldLoseOnPaid || !isPartner) return false;
  return !gate.paidVisibleInnerIds.includes(innerId);
}

export function paidLimitForPlan(plan: PlanId): number {
  return PLAN_DEFAULTS[plan].partnerLimit;
}
