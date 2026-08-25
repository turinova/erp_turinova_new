/**
 * Shoprenter customerGroups create / update / delete.
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import {
  invalidateCustomerGroupsCache,
  type SrCustomerGroup,
} from "@/lib/shoprenter/customers";

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
  const doFetch = () =>
    fetch(url, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
      cache: "no-store",
    });

  let res = await doFetch();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1600));
    res = await doFetch();
  }
  return res;
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function mapGroup(raw: Record<string, unknown>): SrCustomerGroup | null {
  const innerId = toInt(raw.innerId);
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (innerId == null || !id) return null;
  const pct = toInt(raw.percentDiscount);
  return {
    id,
    innerId,
    name: name || `Csoport ${innerId}`,
    percentDiscount: pct,
    isDefault: false,
  };
}

function throwFriendly(kind: string, status: number, text: string): never {
  if (status === 429) {
    throw new Error(
      "A Shoprenter most túl sok kérést kapott (429). Várj 1–2 percet.",
    );
  }
  throw new Error(
    `${kind} sikertelen (${status}): ${text.slice(0, 160)}`,
  );
}

export async function createCustomerGroup(
  config: ShoprenterConfig,
  opts: {
    name: string;
    percentDiscount?: number | null;
    percentDiscountSpecialPrices?: boolean;
  },
): Promise<SrCustomerGroup> {
  const name = opts.name.trim();
  if (name.length < 2 || name.length > 64) {
    throw new Error("A csoport neve 2–64 karakter legyen.");
  }
  const body: Record<string, unknown> = { name };
  if (
    opts.percentDiscount != null &&
    Number.isFinite(opts.percentDiscount) &&
    opts.percentDiscount > 0
  ) {
    body.percentDiscount = String(
      Math.min(100, Math.max(0, Math.round(opts.percentDiscount))),
    );
  }
  if (opts.percentDiscountSpecialPrices != null) {
    body.percentDiscountSpecialPrices = opts.percentDiscountSpecialPrices
      ? "1"
      : "0";
  }

  const res = await apiFetch(config, `/customerGroups`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throwFriendly("Csoport létrehozás", res.status, await res.text());
  }
  const data = (await res.json()) as Record<string, unknown>;
  invalidateCustomerGroupsCache(config.shopName);
  const mapped = mapGroup(data);
  if (!mapped) throw new Error("Csoport létrehozva, de a válasz érvénytelen.");
  return mapped;
}

export async function updateCustomerGroupMeta(
  config: ShoprenterConfig,
  groupOuterId: string,
  opts: {
    name?: string;
    percentDiscount?: number | null;
    percentDiscountSpecialPrices?: boolean;
  },
): Promise<SrCustomerGroup> {
  const body: Record<string, unknown> = {};
  if (opts.name != null) {
    const name = opts.name.trim();
    if (name.length < 2 || name.length > 64) {
      throw new Error("A csoport neve 2–64 karakter legyen.");
    }
    body.name = name;
  }
  if (opts.percentDiscount !== undefined) {
    if (opts.percentDiscount == null || opts.percentDiscount <= 0) {
      body.percentDiscount = "0";
    } else {
      body.percentDiscount = String(
        Math.min(100, Math.max(0, Math.round(opts.percentDiscount))),
      );
    }
  }
  if (opts.percentDiscountSpecialPrices != null) {
    body.percentDiscountSpecialPrices = opts.percentDiscountSpecialPrices
      ? "1"
      : "0";
  }
  if (!Object.keys(body).length) {
    throw new Error("Nincs mit menteni.");
  }

  const res = await apiFetch(
    config,
    `/customerGroups/${encodeURIComponent(groupOuterId)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throwFriendly("Csoport mentés", res.status, await res.text());
  }
  const data = (await res.json()) as Record<string, unknown>;
  invalidateCustomerGroupsCache(config.shopName);
  const mapped = mapGroup(data);
  if (!mapped) throw new Error("Csoport mentve, de a válasz érvénytelen.");
  return mapped;
}

export async function deleteCustomerGroupSr(
  config: ShoprenterConfig,
  groupOuterId: string,
): Promise<void> {
  const res = await apiFetch(
    config,
    `/customerGroups/${encodeURIComponent(groupOuterId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    throwFriendly("Csoport törlés", res.status, await res.text());
  }
  invalidateCustomerGroupsCache(config.shopName);
}
