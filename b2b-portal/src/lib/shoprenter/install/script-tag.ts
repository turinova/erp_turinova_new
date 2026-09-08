/**
 * Shoprenter Script Tag Resource client.
 * @see https://doc.shoprenter.hu/api/script_tag.html
 * @see https://github.com/Shoprenter/sr-api-docs/blob/master/fixtures/api/script_tag/
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { fetchWithTimeout } from "@/lib/shoprenter/http";

export type ScriptTagDisplayScope = "FRONTEND" | "THANK_YOU_PAGE" | "ALL";
export type ScriptTagDisplayArea = "HEADER" | "BODY";

export type ScriptTagRecord = {
  id: string;
  href?: string;
  src: string;
  event?: string;
  displayScope?: string;
  displayArea?: string;
};

function api2BaseUrl(shopName: string): string {
  return `https://${shopName}.api2.myshoprenter.hu/api`;
}

function apiClassicBaseUrl(shopName: string): string {
  return `https://${shopName}.api.myshoprenter.hu`;
}

function baseUrl(config: ShoprenterConfig): string {
  return getAuthMode(config) === "oauth"
    ? api2BaseUrl(config.shopName)
    : apiClassicBaseUrl(config.shopName);
}

async function authHeaders(config: ShoprenterConfig): Promise<HeadersInit> {
  if (getAuthMode(config) === "oauth") {
    const token = await getAccessToken(config);
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }
  if (!config.username || !config.password) {
    throw new Error("Basic auth username/password missing");
  }
  const token = Buffer.from(
    `${config.username}:${config.password}`,
    "utf8",
  ).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function apiFetch(
  config: ShoprenterConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = await authHeaders(config);
  const url = `${baseUrl(config)}${path.startsWith("/") ? path : `/${path}`}`;
  return fetchWithTimeout(
    url,
    {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    },
    { pathLabel: path },
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function mapTag(raw: unknown): ScriptTagRecord | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = typeof o.id === "string" ? o.id : null;
  const src = typeof o.src === "string" ? o.src : null;
  if (!id || !src) return null;
  return {
    id,
    href: typeof o.href === "string" ? o.href : undefined,
    src,
    event: typeof o.event === "string" ? o.event : undefined,
    displayScope:
      typeof o.displayScope === "string" ? o.displayScope : undefined,
    displayArea: typeof o.displayArea === "string" ? o.displayArea : undefined,
  };
}

export async function listScriptTags(
  config: ShoprenterConfig,
): Promise<ScriptTagRecord[]> {
  const res = await apiFetch(config, "/scriptTags?full=1&limit=200&page=0");
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`scriptTags list ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as unknown;
  const root = asRecord(data);
  const items =
    (Array.isArray(root?.items) && root.items) ||
    (Array.isArray(root?.scriptTags) && root.scriptTags) ||
    (Array.isArray(data) ? data : []);
  return items.map(mapTag).filter((t): t is ScriptTagRecord => t != null);
}

export async function createScriptTag(
  config: ShoprenterConfig,
  opts: {
    src: string;
    displayScope?: ScriptTagDisplayScope;
    displayArea?: ScriptTagDisplayArea;
  },
): Promise<ScriptTagRecord> {
  const res = await apiFetch(config, "/scriptTags", {
    method: "POST",
    body: JSON.stringify({
      src: opts.src,
      event: "ONLOAD",
      displayScope: opts.displayScope ?? "FRONTEND",
      displayArea: opts.displayArea ?? "BODY",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`scriptTags create ${res.status}: ${text.slice(0, 240)}`);
  }
  const mapped = mapTag(await res.json());
  if (!mapped) throw new Error("scriptTags create: érvénytelen válasz");
  return mapped;
}

export async function deleteScriptTag(
  config: ShoprenterConfig,
  scriptTagId: string,
): Promise<void> {
  const id = encodeURIComponent(scriptTagId);
  const res = await apiFetch(config, `/scriptTags/${id}`, { method: "DELETE" });
  if (res.status === 204 || res.status === 404 || res.ok) return;
  const text = await res.text();
  throw new Error(`scriptTags delete ${res.status}: ${text.slice(0, 200)}`);
}

/** Find an existing ProGate loader tag by src substring. */
export function findProgateScriptTag(
  tags: ScriptTagRecord[],
  publicId: string,
): ScriptTagRecord | null {
  const needle = `shopId=${encodeURIComponent(publicId)}`;
  const hit = tags.find(
    (t) =>
      t.src.includes("/widget.js") &&
      (t.src.includes(needle) || t.src.includes(`shopId=${publicId}`)),
  );
  return hit ?? null;
}
