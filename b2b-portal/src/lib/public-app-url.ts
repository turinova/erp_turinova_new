/** Public URL the storefront widget should call (tunnel or prod, not a placeholder). */

export function publicAppUrl(h: Headers): string {
  const xfHost = (h.get("x-forwarded-host") || h.get("host") || "")
    .split(",")[0]
    .trim();
  const xfProto = (h.get("x-forwarded-proto") || "").split(",")[0].trim();
  const hostIsLocal =
    !xfHost ||
    xfHost.startsWith("localhost") ||
    xfHost.startsWith("127.0.0.1");

  const env = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const envIsLocal =
    !env || env.includes("localhost") || env.includes("127.0.0.1");

  if (xfHost && !hostIsLocal) {
    const proto = xfProto || "https";
    return `${proto}://${xfHost}`.replace(/\/$/, "");
  }
  if (env && !envIsLocal) return env;

  const vercelHost = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  )
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (vercelHost && !vercelHost.startsWith("localhost")) {
    return `https://${vercelHost}`;
  }

  if (xfHost) {
    const proto = xfProto || "http";
    return `${proto}://${xfHost}`.replace(/\/$/, "");
  }
  return env || "http://localhost:3030";
}

export function isLocalAppUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return url.includes("localhost");
  }
}
