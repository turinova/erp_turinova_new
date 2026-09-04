/**
 * Marketing landing mode.
 * - live: full ProGateLanding
 * - coming_soon: Hamarosan placeholder (logo + contact)
 *
 * Portal (/login, /home, widget API) is unaffected.
 */
export type ProGateLandingMode = "live" | "coming_soon";

export function getProGateLandingMode(): ProGateLandingMode {
  const raw = (process.env.PROGATE_LANDING_MODE || "live").trim().toLowerCase();
  return raw === "coming_soon" ? "coming_soon" : "live";
}

export function isProGateLandingComingSoon(): boolean {
  return getProGateLandingMode() === "coming_soon";
}
