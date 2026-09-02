/**
 * Shoprenter customer groups + customers (merchant Vevők).
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { fetchWithTimeout } from "@/lib/shoprenter/http";

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
    fetchWithTimeout(
      url,
      {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
      },
      { pathLabel: path },
    );

  let res = await doFetch();
  // Shoprenter rate limit — egy rövid várás + 1 retry
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

/** Parse customer_group_id from outer id / href — zero network. */
function innerIdFromGroupRef(groupRef: Record<string, unknown>): number | null {
  const direct = toInt(groupRef.innerId);
  if (direct != null) return direct;

  const id = typeof groupRef.id === "string" ? groupRef.id : null;
  if (id) {
    try {
      const decoded = Buffer.from(id, "base64").toString("utf8");
      const m = decoded.match(/customer_group_id=(\d+)/i);
      if (m) return Number(m[1]);
    } catch {
      /* ignore */
    }
  }

  const href = typeof groupRef.href === "string" ? groupRef.href : null;
  if (href) {
    const m =
      href.match(/customer_group_id[=-](\d+)/i) ||
      href.match(/customerGroups\/[^/?]*[=-](\d+)/i);
    if (m) return Number(m[1]);
    // trailing outer id in path
    const seg = href.split("/").pop();
    if (seg) {
      try {
        const decoded = Buffer.from(seg, "base64").toString("utf8");
        const m2 = decoded.match(/customer_group_id=(\d+)/i);
        if (m2) return Number(m2[1]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function resolveGroupFromRef(
  groupRef: unknown,
  groups?: SrCustomerGroup[],
): { id: string | null; innerId: number | null; name: string | null } {
  if (!groupRef || typeof groupRef !== "object") {
    return { id: null, innerId: null, name: null };
  }
  const g = groupRef as Record<string, unknown>;
  const id = typeof g.id === "string" ? g.id : null;
  let innerId = innerIdFromGroupRef(g);
  let name = typeof g.name === "string" ? g.name : null;

  if (groups?.length) {
    const hit =
      (innerId != null ? groups.find((x) => x.innerId === innerId) : null) ||
      (id ? groups.find((x) => x.id === id) : null);
    if (hit) {
      return { id: hit.id, innerId: hit.innerId, name: hit.name };
    }
  }

  return { id, innerId, name };
}

export type SrCustomerGroup = {
  id: string;
  innerId: number;
  name: string;
  percentDiscount: number | null;
  isDefault: boolean;
};

export type SrCustomer = {
  id: string;
  innerId: number;
  email: string;
  firstname: string;
  lastname: string;
  telephone: string | null;
  approved: boolean;
  status: string | null;
  dateCreated: string | null;
  groupId: string | null;
  groupInnerId: number | null;
  groupName: string | null;
};

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
    // Official Customer Group Resource has no `default` field — set later via settings.
    isDefault: false,
  };
}

/**
 * Shoprenter alap vevőcsoport: Setting `config_customer_group_id`
 * (doc.shoprenter.hu Setting Resource — nem a /customerGroups `default` mezője).
 * Value: Customer Group Resource ID (outer id) vagy numeric innerId.
 */
export async function fetchConfigCustomerGroupValue(
  config: ShoprenterConfig,
): Promise<string | null> {
  const res = await apiFetch(
    config,
    `/settings?key=${encodeURIComponent("config_customer_group_id")}&full=1&limit=10&page=0`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Alap vevőcsoport setting sikertelen (${res.status}): ${text.slice(0, 160)}`,
    );
  }
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  for (const item of data.items ?? []) {
    const key = typeof item.key === "string" ? item.key : "";
    if (key !== "config_customer_group_id") continue;
    if (item.value == null) return null;
    const v = String(item.value).trim();
    return v || null;
  }
  return null;
}

function resolveDefaultInnerId(
  value: string | null,
  groups: SrCustomerGroup[],
): number | null {
  if (!value) return null;

  const byResourceId = groups.find((g) => g.id === value);
  if (byResourceId) return byResourceId.innerId;

  const asInt = toInt(value);
  if (asInt != null && groups.some((g) => g.innerId === asInt)) {
    return asInt;
  }

  // Outer id: base64("customerGroup-customer_group_id=N")
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const m = decoded.match(/customer_group_id=(\d+)/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && groups.some((g) => g.innerId === n)) return n;
    }
  } catch {
    /* ignore */
  }

  return asInt;
}

/** Short TTL — Vevők oldal groups+customers egyszerre hívja; védi a Shoprenter limitet. */
const groupsCache = new Map<
  string,
  { at: number; groups: SrCustomerGroup[] }
>();
const GROUPS_TTL_MS = 45_000;

export function invalidateCustomerGroupsCache(shopName?: string): void {
  if (!shopName) {
    groupsCache.clear();
    return;
  }
  groupsCache.delete(shopName.toLowerCase());
}

export async function listCustomerGroups(
  config: ShoprenterConfig,
  opts?: { bypassCache?: boolean },
): Promise<SrCustomerGroup[]> {
  const cacheKey = config.shopName.toLowerCase();
  if (!opts?.bypassCache) {
    const hit = groupsCache.get(cacheKey);
    if (hit && Date.now() - hit.at < GROUPS_TTL_MS) {
      return hit.groups.map((g) => ({ ...g }));
    }
  }

  const out: SrCustomerGroup[] = [];
  let page = 0;
  for (;;) {
    const res = await apiFetch(
      config,
      `/customerGroups?full=1&limit=100&page=${page}`,
    );
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          "A Shoprenter most túl sok kérést kapott (429). Várj 1–2 percet, majd Frissítés.",
        );
      }
      const text = await res.text();
      throw new Error(
        `Vevőcsoportok betöltése sikertelen (${res.status}): ${text.slice(0, 160)}`,
      );
    }
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
      pageCount?: number | string;
    };
    for (const item of data.items ?? []) {
      const g = mapGroup(item);
      if (g) out.push(g);
    }
    const pageCount = toInt(data.pageCount) ?? 1;
    page += 1;
    if (page >= pageCount || !(data.items?.length)) break;
    if (page > 50) break;
  }

  let defaultInnerId: number | null = null;
  try {
    const raw = await fetchConfigCustomerGroupValue(config);
    defaultInnerId = resolveDefaultInnerId(raw, out);
  } catch (err) {
    console.warn("[shoprenter] config_customer_group_id", err);
  }

  if (defaultInnerId != null) {
    for (const g of out) {
      g.isDefault = g.innerId === defaultInnerId;
    }
  }

  groupsCache.set(cacheKey, { at: Date.now(), groups: out });
  return out.map((g) => ({ ...g }));
}

function mapCustomerBase(raw: Record<string, unknown>): Omit<
  SrCustomer,
  "groupId" | "groupInnerId" | "groupName"
> | null {
  const innerId = toInt(raw.innerId);
  const id = typeof raw.id === "string" ? raw.id : null;
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (innerId == null || !id) return null;
  return {
    id,
    innerId,
    email,
    firstname: typeof raw.firstname === "string" ? raw.firstname : "",
    lastname: typeof raw.lastname === "string" ? raw.lastname : "",
    telephone: typeof raw.telephone === "string" ? raw.telephone : null,
    approved: raw.approved === true || raw.approved === "1" || raw.approved === 1,
    status: raw.status != null ? String(raw.status) : null,
    dateCreated: typeof raw.dateCreated === "string" ? raw.dateCreated : null,
  };
}

function mapCustomerRow(
  item: Record<string, unknown>,
  groups?: SrCustomerGroup[],
): SrCustomer | null {
  const base = mapCustomerBase(item);
  if (!base) return null;
  const g = resolveGroupFromRef(item.customerGroup, groups);
  return {
    ...base,
    groupId: g.id,
    groupInnerId: g.innerId,
    groupName: g.name,
  };
}

function throwFriendlyHttp(kind: string, status: number, text: string): never {
  if (status === 429) {
    throw new Error(
      "A Shoprenter most túl sok kérést kapott (429). Várj 1–2 percet, majd Frissítés.",
    );
  }
  throw new Error(
    `${kind} sikertelen (${status}): ${text.slice(0, 160)}`,
  );
}

function customerMatchesQuery(c: SrCustomer, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  const hay = [
    c.email,
    c.firstname,
    c.lastname,
    `${c.lastname} ${c.firstname}`,
    `${c.firstname} ${c.lastname}`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

async function fetchCustomersByParam(
  config: ShoprenterConfig,
  param: "email" | "innerId",
  value: string,
  opts?: { limit?: number; groups?: SrCustomerGroup[] },
): Promise<SrCustomer[]> {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 25));
  const qs = new URLSearchParams({
    full: "1",
    limit: String(limit),
    page: "0",
    [param]: value,
  });
  const res = await apiFetch(config, `/customers?${qs.toString()}`);
  if (!res.ok) {
    throwFriendlyHttp("Vevő keresés", res.status, await res.text());
  }
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  const out: SrCustomer[] = [];
  for (const item of data.items ?? []) {
    const row = mapCustomerRow(item, opts?.groups);
    if (row) out.push(row);
  }
  return out;
}

/**
 * Shoprenter customer collection only filters by email / innerId (no name).
 * Name and partial text: scan recent pages and match locally.
 */
export async function searchCustomers(
  config: ShoprenterConfig,
  q: string,
  opts?: { limit?: number; groups?: SrCustomerGroup[] },
): Promise<SrCustomer[]> {
  const query = q.trim();
  if (!query) return [];
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 25));

  if (query.includes("@")) {
    return fetchCustomersByParam(config, "email", query, opts);
  }
  if (/^\d+$/.test(query)) {
    return fetchCustomersByParam(config, "innerId", query, opts);
  }

  const seen = new Set<number>();
  const out: SrCustomer[] = [];
  const push = (row: SrCustomer) => {
    if (seen.has(row.innerId)) return;
    if (!customerMatchesQuery(row, query)) return;
    seen.add(row.innerId);
    out.push(row);
  };

  // Exact/prefix email attempts (some shops store partial lookups); then scan.
  try {
    const emailHits = await fetchCustomersByParam(config, "email", query, {
      limit,
      groups: opts?.groups,
    });
    for (const row of emailHits) push(row);
  } catch {
    /* scan below */
  }

  let page = 0;
  let pageCount = 1;
  const maxPages = 20;
  while (out.length < limit && page < pageCount && page < maxPages) {
    const listed = await listRecentCustomers(config, {
      limit: 50,
      page,
      groups: opts?.groups,
    });
    pageCount = Math.max(1, listed.pageCount);
    for (const row of listed.customers) {
      push(row);
      if (out.length >= limit) break;
    }
    page += 1;
    if (listed.customers.length === 0) break;
  }
  return out.slice(0, limit);
}

export async function listRecentCustomers(
  config: ShoprenterConfig,
  opts?: { limit?: number; page?: number; groups?: SrCustomerGroup[] },
): Promise<{ customers: SrCustomer[]; pageCount: number }> {
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 25));
  const page = Math.max(0, opts?.page ?? 0);
  const res = await apiFetch(
    config,
    `/customers?full=1&limit=${limit}&page=${page}`,
  );
  if (!res.ok) {
    throwFriendlyHttp("Vevők listázása", res.status, await res.text());
  }
  const data = (await res.json()) as {
    items?: Record<string, unknown>[];
    pageCount?: number | string;
  };
  const out: SrCustomer[] = [];
  for (const item of data.items ?? []) {
    const row = mapCustomerRow(item, opts?.groups);
    if (row) out.push(row);
  }
  return {
    customers: out,
    pageCount: Math.max(1, toInt(data.pageCount) ?? 1),
  };
}

export async function getCustomerByInnerId(
  config: ShoprenterConfig,
  innerId: number,
  opts?: { groups?: SrCustomerGroup[] },
): Promise<SrCustomer | null> {
  const found = await searchCustomers(config, String(innerId), {
    limit: 1,
    groups: opts?.groups,
  });
  return found[0] ?? null;
}

export type SrAddress = {
  id: string;
  innerId: number | null;
  firstname: string;
  lastname: string;
  company: string | null;
  taxNumber: string | null;
  address1: string;
  address2: string | null;
  postcode: string;
  city: string;
  country: string | null;
  zone: string | null;
  telephone: string | null;
  type: string | null;
};

function strField(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function mapAddress(raw: Record<string, unknown>): SrAddress | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) return null;
  const countryObj = raw.country;
  let country: string | null = null;
  if (typeof countryObj === "string") country = countryObj;
  else if (countryObj && typeof countryObj === "object") {
    const c = countryObj as Record<string, unknown>;
    country = strField(c, "name", "countryName") || null;
  }
  const zoneObj = raw.zone;
  let zone: string | null = null;
  if (typeof zoneObj === "string") zone = zoneObj;
  else if (zoneObj && typeof zoneObj === "object") {
    const z = zoneObj as Record<string, unknown>;
    zone = strField(z, "name", "zoneName") || null;
  }
  return {
    id,
    innerId: toInt(raw.innerId),
    firstname: strField(raw, "firstname", "firstName"),
    lastname: strField(raw, "lastname", "lastName"),
    company: strField(raw, "company") || null,
    taxNumber:
      strField(raw, "taxnumber", "taxNumber", "tax_number") || null,
    address1: strField(raw, "address1", "address_1"),
    address2: strField(raw, "address2", "address_2") || null,
    postcode: strField(raw, "postcode", "postalCode", "zip"),
    city: strField(raw, "city"),
    country,
    zone,
    telephone: strField(raw, "telephone", "phone") || null,
    type: strField(raw, "type") || null,
  };
}

/**
 * Vevő címei — max 1–2 SR hívás (customerId, fallback: customer).
 */
export async function listAddressesForCustomer(
  config: ShoprenterConfig,
  customerOuterId: string,
): Promise<SrAddress[]> {
  const attempts = [
    `/addresses?full=1&limit=50&page=0&customerId=${encodeURIComponent(customerOuterId)}`,
    `/addresses?full=1&limit=50&page=0&customer=${encodeURIComponent(customerOuterId)}`,
  ];
  for (const path of attempts) {
    const res = await apiFetch(config, path);
    if (res.status === 429) {
      throw new Error(
        "A Shoprenter most túl sok kérést kapott (429). Várj 1–2 percet, majd Frissítés.",
      );
    }
    if (!res.ok) continue;
    const data = (await res.json()) as { items?: Record<string, unknown>[] };
    const items = data.items ?? [];
    if (!items.length) continue;
    const out: SrAddress[] = [];
    for (const item of items) {
      const a = mapAddress(item);
      if (a) out.push(a);
    }
    if (out.length) return out;
  }
  return [];
}

/**
 * Shoprenter resource IDs are base64 and often end with `=`.
 * Official docs put them raw in the path (e.g. /customers/…MjQ=).
 * encodeURIComponent turns `=` into `%3D` and SR returns 40401.
 */
function resourceIdInPath(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function innerIdFromCustomerOuterId(outerId: string): number | null {
  try {
    const decoded = Buffer.from(resourceIdInPath(outerId), "base64").toString(
      "utf8",
    );
    const m = decoded.match(/customer_id=(\d+)/i);
    if (m) return Number(m[1]);
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchCustomerFullRaw(
  config: ShoprenterConfig,
  customerId: string,
): Promise<Record<string, unknown>> {
  const pathId = resourceIdInPath(customerId);
  // Prefer list-by-innerId (same pattern as getCustomerEmailByUserId) —
  // avoids path-encoding issues on some SR stacks.
  const innerId = innerIdFromCustomerOuterId(pathId);
  if (innerId != null) {
    const listRes = await apiFetch(
      config,
      `/customers?innerId=${innerId}&full=1&limit=1`,
    );
    if (listRes.ok) {
      const data = (await listRes.json()) as {
        items?: Record<string, unknown>[];
      };
      const item = data.items?.[0];
      if (item && typeof item.id === "string") return item;
    }
  }

  const getRes = await apiFetch(config, `/customers/${pathId}?full=1`);
  if (!getRes.ok) {
    const text = await getRes.text();
    throw new Error(
      `Vevő betöltése átrakáshoz sikertelen (${getRes.status}): ${text.slice(0, 200)}`,
    );
  }
  return (await getRes.json()) as Record<string, unknown>;
}

export async function updateCustomerGroup(
  config: ShoprenterConfig,
  customerId: string,
  customerGroupId: string,
): Promise<void> {
  // Shoprenter PUT /customers/:id requires firstname, lastname, email,
  // telephone, password even when only changing customerGroup (see
  // sr-api-docs fixtures/api/customer/request/put.json). Echo the existing
  // bcrypt hash so the login password is not reset.
  const raw = await fetchCustomerFullRaw(config, customerId);
  const pathId = resourceIdInPath(
    typeof raw.id === "string" && raw.id.trim() ? raw.id : customerId,
  );
  const firstname =
    typeof raw.firstname === "string" && raw.firstname.trim()
      ? raw.firstname.trim()
      : "-";
  const lastname =
    typeof raw.lastname === "string" && raw.lastname.trim()
      ? raw.lastname.trim()
      : "-";
  const email =
    typeof raw.email === "string" && raw.email.trim() ? raw.email.trim() : "";
  if (!email) {
    throw new Error(
      "A vevőnek nincs email címe a Shoprenterben; átrakás nem lehetséges.",
    );
  }
  const telephone =
    typeof raw.telephone === "string" && raw.telephone.trim()
      ? raw.telephone.trim()
      : "-";
  const password =
    typeof raw.password === "string" && raw.password.trim()
      ? raw.password.trim()
      : "";
  if (!password) {
    throw new Error(
      "A vevő jelszóhash-e nem olvasható a Shoprenterből; átrakás nem lehetséges.",
    );
  }

  const groupId = resourceIdInPath(customerGroupId);

  const res = await apiFetch(config, `/customers/${pathId}`, {
    method: "PUT",
    body: JSON.stringify({
      firstname,
      lastname,
      email,
      telephone,
      password,
      customerGroup: { id: groupId },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Átrakás sikertelen (${res.status}): ${text.slice(0, 200)}`,
    );
  }
}
