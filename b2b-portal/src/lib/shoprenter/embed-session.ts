import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  getSrAppClientSecret,
  isEmbedDevBypassAllowed,
} from "@/lib/shoprenter/embed-hmac";

import {
  EMBED_SESSION_HEADER,
  EMBED_SESSION_QUERY,
  withEmbedToken,
} from "@/lib/shoprenter/embed-token";

export const EMBED_SESSION_COOKIE = "progate_sr_embed";
export { EMBED_SESSION_HEADER, EMBED_SESSION_QUERY, withEmbedToken };

export type EmbedSession = {
  shopId: string;
  organizationId: string;
  shopName: string;
  publicId: string;
  exp: number;
};

function signingSecret(): string | null {
  return (
    getSrAppClientSecret() ||
    process.env.SESSION_SECRET?.trim() ||
    (isEmbedDevBypassAllowed() ? "dev-embed-secret" : null)
  );
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function sign(payloadB64: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payloadB64).digest());
}

export function encodeEmbedSession(
  session: Omit<EmbedSession, "exp"> & { exp?: number },
  ttlSec = 12 * 60 * 60,
): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const body: EmbedSession = {
    shopId: session.shopId,
    organizationId: session.organizationId,
    shopName: session.shopName,
    publicId: session.publicId,
    exp: session.exp ?? Math.floor(Date.now() / 1000) + ttlSec,
  };
  const payloadB64 = b64url(JSON.stringify(body));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function decodeEmbedSession(token: string): EmbedSession | null {
  const secret = signingSecret();
  if (!secret) return null;
  const raw = token.trim();
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64, secret);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = fromB64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as EmbedSession;
    if (
      !parsed?.shopId ||
      !parsed?.organizationId ||
      !parsed?.shopName ||
      !parsed?.publicId ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Cookie flags for Shoprenter admin iframe → app.progate.hu (cross-site). */
export function embedSessionCookieOptions(expiresAt: Date) {
  const secure =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    process.env.SR_EMBED_SECURE_COOKIE === "1";
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    expires: expiresAt,
    ...(secure ? { partitioned: true as const } : {}),
  };
}

/** Best-effort Set-Cookie from an already-encoded token. */
export function setEmbedSessionCookieOnResponse(
  res: NextResponse,
  token: string,
): void {
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  res.cookies.set(
    EMBED_SESSION_COOKIE,
    token,
    embedSessionCookieOptions(expiresAt),
  );
}

/**
 * Encode session, Set-Cookie on response, return token for `?e=` redirect.
 */
export function applyEmbedSessionCookie(
  res: NextResponse,
  session: Omit<EmbedSession, "exp">,
): string | null {
  const token = encodeEmbedSession(session);
  if (!token) return null;
  setEmbedSessionCookieOnResponse(res, token);
  return token;
}

/** @deprecated Prefer applyEmbedSessionCookie on the redirect response. */
export async function setEmbedSessionCookie(
  session: Omit<EmbedSession, "exp">,
): Promise<boolean> {
  const token = encodeEmbedSession(session);
  if (!token) return false;
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const jar = await cookies();
  jar.set(EMBED_SESSION_COOKIE, token, embedSessionCookieOptions(expiresAt));
  return true;
}

export async function clearEmbedSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(EMBED_SESSION_COOKIE, "", {
    ...embedSessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
}

export async function getEmbedSessionFromCookies(): Promise<EmbedSession | null> {
  const jar = await cookies();
  const raw = jar.get(EMBED_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeEmbedSession(raw);
}

/**
 * Session from URL `e=` (preferred in iframe) or cookie.
 */
export async function resolveEmbedSession(
  tokenFromQuery?: string | null,
): Promise<{ session: EmbedSession; token: string } | null> {
  const q = (tokenFromQuery || "").trim();
  if (q) {
    const session = decodeEmbedSession(q);
    if (session) return { session, token: q };
  }
  const jar = await cookies();
  const raw = jar.get(EMBED_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = decodeEmbedSession(raw);
  if (!session) return null;
  return { session, token: raw };
}

/**
 * API auth: header → query `e` → cookie.
 */
export async function resolveEmbedSessionFromRequest(
  req: Request,
): Promise<EmbedSession | null> {
  const header = req.headers.get(EMBED_SESSION_HEADER)?.trim();
  if (header) {
    const s = decodeEmbedSession(header);
    if (s) return s;
  }
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get(EMBED_SESSION_QUERY)?.trim();
    if (q) {
      const s = decodeEmbedSession(q);
      if (s) return s;
    }
  } catch {
    /* ignore */
  }
  return getEmbedSessionFromCookies();
}
