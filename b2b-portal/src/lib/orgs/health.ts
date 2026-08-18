export type HealthLevel = "ok" | "warn" | "crit";

export type HealthInput = {
  status: "trial" | "active" | "suspended";
  trialEndsAt: string | null;
  widgetEnabled: boolean;
  shopStatus: string | null;
  catalogStatus: string | null;
  productCount: number;
  partnerUsed: number;
  partnerLimit: number;
  skuUsed: number;
  skuLimit: number;
  jobStatus: string | null;
  jobCreatedAt: string | null;
  ownerLastLoginAt: string | null;
  orgCreatedAt: string;
  inviteStatus: string | null;
  inviteExpiresAt: string | null;
};

export function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function isTrialActive(
  status: string,
  trialEndsAt: string | null,
): boolean {
  return (
    status === "trial" &&
    trialEndsAt != null &&
    new Date(trialEndsAt).getTime() > Date.now()
  );
}

export function isTrialExpired(
  status: string,
  trialEndsAt: string | null,
): boolean {
  return status === "trial" && !isTrialActive(status, trialEndsAt);
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export function computeHealth(i: HealthInput): {
  health: HealthLevel;
  reason: string;
} {
  if (i.status === "suspended") {
    return { health: "crit", reason: "Felfüggesztve" };
  }
  if (isTrialExpired(i.status, i.trialEndsAt)) {
    return { health: "crit", reason: "Lejárt a próba" };
  }
  if (i.shopStatus === "needs_reauth" && i.widgetEnabled) {
    return {
      health: "crit",
      reason: "A bolt nem válaszol, a gyors rendelés be van",
    };
  }
  if (i.catalogStatus === "error") {
    return { health: "crit", reason: "A termékmásolás elhasalt" };
  }
  if (
    i.catalogStatus === "ready" &&
    i.productCount === 0 &&
    i.shopStatus !== "draft" &&
    i.shopStatus != null
  ) {
    return { health: "crit", reason: "Üres katalógus" };
  }

  const overCap = i.partnerLimit > 0 && i.partnerUsed > i.partnerLimit;
  if (overCap) {
    return {
      health: "warn",
      reason: "Betelt a vevőcsomag — a portál rejt, a gyors rendelés megy",
    };
  }
  if (i.partnerLimit > 0 && i.partnerUsed / i.partnerLimit >= 0.8) {
    return { health: "warn", reason: "Közel a teli a vevőcsomag" };
  }
  if (i.catalogStatus === "blocked_limit") {
    return { health: "warn", reason: "Termékhely teli — új termék nem jön" };
  }
  if (i.skuLimit > 0 && i.skuUsed / i.skuLimit >= 1) {
    return { health: "warn", reason: "Termékhely teli — új termék nem jön" };
  }
  if (i.skuLimit > 0 && i.skuUsed / i.skuLimit >= 0.8) {
    return { health: "warn", reason: "Közel a teli a termékhely" };
  }
  if (i.catalogStatus === "degraded") {
    return { health: "warn", reason: "A termékek részben frissek" };
  }
  if (i.shopStatus === "needs_reauth") {
    return { health: "warn", reason: "A bolt nem válaszol" };
  }

  const jobAgeH = hoursSince(i.jobCreatedAt);
  if (
    (i.jobStatus === "running" || i.jobStatus === "queued") &&
    jobAgeH != null &&
    jobAgeH >= 3
  ) {
    return { health: "warn", reason: "A termékmásolás elakadt" };
  }

  if (isTrialActive(i.status, i.trialEndsAt)) {
    const days = trialDaysLeft(i.trialEndsAt);
    if (days != null && days <= 7) {
      return { health: "warn", reason: `Próba: ${days} nap van hátra` };
    }
  }

  if (
    i.inviteStatus === "pending" &&
    i.inviteExpiresAt &&
    new Date(i.inviteExpiresAt).getTime() <= Date.now()
  ) {
    return { health: "warn", reason: "A meghívó lejárt" };
  }

  if (!i.ownerLastLoginAt) {
    const age = daysSince(i.orgCreatedAt);
    if (age != null && age >= 7) {
      return { health: "warn", reason: "Az owner még nem lépett be" };
    }
  }

  return { health: "ok", reason: "Rendben" };
}

export function catalogLabel(status: string | null | undefined): string {
  switch (status) {
    case "ready":
      return "kész";
    case "syncing":
    case "pending":
      return "másolódik";
    case "error":
      return "hiba";
    case "blocked_limit":
      return "teli";
    case "degraded":
      return "részben";
    default:
      return "—";
  }
}

export function healthLabel(h: HealthLevel): string {
  if (h === "crit") return "Ég";
  if (h === "warn") return "Figyelj";
  return "Rendben";
}
