export type PartnerGateDto = {
  activePartners: number;
  partnerLimit: number;
  overCap: boolean;
  warn80: boolean;
  visibleInnerIds: number[];
  plan: string;
  planLabel: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
};

export const UPGRADE_MAILTO =
  "mailto:hello@turinova.hu?subject=" +
  encodeURIComponent("Nagyobb csomag kellene");

export function isPartnerLocked(
  isPartner: boolean | undefined,
  innerId: number,
  gate: PartnerGateDto | null,
): boolean {
  if (!gate?.overCap || !isPartner) return false;
  return !gate.visibleInnerIds.includes(innerId);
}
