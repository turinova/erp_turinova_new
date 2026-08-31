export type MarketingSignature = {
  name: string;
  title: string;
  phone: string;
  email: string;
  extra: string;
};

export type MarketingProfile = {
  logoUrl: string;
  shopNameOverride: string;
  shopUrlOverride: string;
  signature: MarketingSignature;
  launchEmailAcknowledgedAt: string | null;
};

export type PartnerActivationDto = {
  shopName: string;
  shopUrl: string | null;
  buttonLabel: string;
  widgetEnabled: boolean;
  catalogReady: boolean;
  hasPricing: boolean;
  widgetOrdersMonth: number;
  profile: MarketingProfile;
};

export const EMPTY_SIGNATURE: MarketingSignature = {
  name: "",
  title: "",
  phone: "",
  email: "",
  extra: "",
};

export const DEFAULT_MARKETING_PROFILE: MarketingProfile = {
  logoUrl: "",
  shopNameOverride: "",
  shopUrlOverride: "",
  signature: { ...EMPTY_SIGNATURE },
  launchEmailAcknowledgedAt: null,
};

function str(raw: unknown, max = 500): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, max);
}

export function normalizeMarketingProfile(raw: unknown): MarketingProfile {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const sigRaw =
    obj.signature && typeof obj.signature === "object"
      ? (obj.signature as Record<string, unknown>)
      : {};
  const ack = obj.launchEmailAcknowledgedAt;
  return {
    logoUrl: str(obj.logoUrl, 2000),
    shopNameOverride: str(obj.shopNameOverride, 200),
    shopUrlOverride: str(obj.shopUrlOverride, 2000),
    signature: {
      name: str(sigRaw.name, 120),
      title: str(sigRaw.title, 120),
      phone: str(sigRaw.phone, 80),
      email: str(sigRaw.email, 200),
      extra: str(sigRaw.extra, 300),
    },
    launchEmailAcknowledgedAt:
      typeof ack === "string" && ack.trim() ? ack.trim() : null,
  };
}

export function resolveShopDisplayName(
  profile: MarketingProfile,
  fallback: string,
): string {
  return profile.shopNameOverride.trim() || fallback.trim() || "Webshop";
}

export function resolveShopUrl(
  profile: MarketingProfile,
  fallback: string | null,
): string {
  const override = profile.shopUrlOverride.trim();
  if (override) return override.replace(/\/$/, "");
  if (fallback?.trim()) return fallback.trim().replace(/\/$/, "");
  return "";
}

export function loginUrlForShop(shopUrl: string): string {
  if (!shopUrl) return "";
  return `${shopUrl.replace(/\/$/, "")}/account/login`;
}

export type { BuiltLaunchEmail, LaunchEmailContext } from "@/lib/merchant/partner-activation-email";
export { buildLaunchPartnerEmail } from "@/lib/merchant/partner-activation-email";
