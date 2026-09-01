import { COMPANY } from "@/lib/company";

export function normalizeHost(raw: string): string {
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function hostFromHeaders(headers: Headers): string {
  return normalizeHost(
    headers.get("x-forwarded-host") || headers.get("host") || "",
  );
}

export function isLocalHost(host: string): boolean {
  const h = normalizeHost(host);
  return !h || h === "localhost" || h === "127.0.0.1";
}

export function isMarketingHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === COMPANY.marketingHost || h === `www.${COMPANY.marketingHost}`;
}

export function isAppHost(host: string): boolean {
  return normalizeHost(host) === COMPANY.productHost;
}

function useProductionHosts(): boolean {
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    return isMarketingHost(h) || isAppHost(h);
  }
  return process.env.VERCEL_ENV === "production";
}

/** App routes (login, signup, portal) — absolute on production so marketing host stays cookieless. */
export function appPathHref(path: string): string {
  if (useProductionHosts()) {
    return `${COMPANY.productUrl}${path}`;
  }
  return path;
}

export function appAuthHref(path: "/login" | "/signup"): string {
  return appPathHref(path);
}

export function marketingHomeHref(): string {
  if (useProductionHosts()) {
    return `${COMPANY.marketingUrl}/`;
  }
  return "/";
}
