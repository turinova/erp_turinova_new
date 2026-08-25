/**
 * Shoprenter customerGroupProductPrices CRUD.
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";

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

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = toNumber(v);
  return n != null ? Math.trunc(n) : null;
}

/** Outer id: product-product_id=N */
export function productOuterIdFromInner(innerId: number): string {
  return Buffer.from(`product-product_id=${innerId}`, "utf8").toString(
    "base64",
  );
}

export function productInnerIdFromRef(
  ref: unknown,
): number | null {
  if (!ref || typeof ref !== "object") return null;
  const r = ref as Record<string, unknown>;
  const direct = toInt(r.innerId);
  if (direct != null) return direct;

  const id = typeof r.id === "string" ? r.id : null;
  if (id) {
    try {
      const decoded = Buffer.from(id, "base64").toString("utf8");
      const m = decoded.match(/product_id=(\d+)/i);
      if (m) return Number(m[1]);
    } catch {
      /* ignore */
    }
    if (/^\d+$/.test(id)) return Number(id);
  }

  const href = typeof r.href === "string" ? r.href : null;
  if (href) {
    const m =
      href.match(/product_id[=-](\d+)/i) ||
      href.match(/products\/([^/?]+)/i);
    if (m) {
      if (/^\d+$/.test(m[1])) return Number(m[1]);
      try {
        const decoded = Buffer.from(m[1], "base64").toString("utf8");
        const m2 = decoded.match(/product_id=(\d+)/i);
        if (m2) return Number(m2[1]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export type SrGroupPrice = {
  id: string;
  priceNet: number;
  productInnerId: number | null;
  productOuterId: string | null;
};

function mapGroupPrice(raw: Record<string, unknown>): SrGroupPrice | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const priceNet = toNumber(raw.price);
  if (!id || priceNet == null) return null;
  const product = raw.product;
  const productInnerId = productInnerIdFromRef(product);
  let productOuterId: string | null = null;
  if (product && typeof product === "object") {
    const p = product as Record<string, unknown>;
    if (typeof p.id === "string") productOuterId = p.id;
  }
  return { id, priceNet, productInnerId, productOuterId };
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

/**
 * Összes saját ár egy csoportra (lapozva).
 * @param customerGroupOuterId — SR customerGroups outer id
 */
export async function listGroupPricesForGroup(
  config: ShoprenterConfig,
  customerGroupOuterId: string,
  opts?: { maxPages?: number },
): Promise<SrGroupPrice[]> {
  const out: SrGroupPrice[] = [];
  const maxPages = Math.min(50, opts?.maxPages ?? 50);
  let page = 0;
  for (;;) {
    const qs = new URLSearchParams({
      full: "1",
      limit: "200",
      page: String(page),
      customerGroupId: customerGroupOuterId,
    });
    const res = await apiFetch(
      config,
      `/customerGroupProductPrices?${qs.toString()}`,
    );
    if (!res.ok) {
      throwFriendly("Csoportárak betöltése", res.status, await res.text());
    }
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
      pageCount?: number | string;
    };
    for (const item of data.items ?? []) {
      const row = mapGroupPrice(item);
      if (row) out.push(row);
    }
    const pageCount = toInt(data.pageCount) ?? 1;
    page += 1;
    if (page >= pageCount || !(data.items?.length)) break;
    if (page >= maxPages) break;
  }
  return out;
}

export async function findGroupPrice(
  config: ShoprenterConfig,
  customerGroupOuterId: string,
  productOuterId: string,
): Promise<SrGroupPrice | null> {
  const qs = new URLSearchParams({
    full: "1",
    limit: "10",
    page: "0",
    customerGroupId: customerGroupOuterId,
    productId: productOuterId,
  });
  const res = await apiFetch(
    config,
    `/customerGroupProductPrices?${qs.toString()}`,
  );
  if (!res.ok) {
    throwFriendly("Csoportár keresés", res.status, await res.text());
  }
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  for (const item of data.items ?? []) {
    const row = mapGroupPrice(item);
    if (row) return row;
  }
  return null;
}

/** Csoportárak csak a megadott termékekre (Árak oldal — ne az egész cenniket húzza). */
export async function mapGroupPricesForProductInners(
  config: ShoprenterConfig,
  customerGroupOuterId: string,
  productInnerIds: number[],
  opts?: { concurrency?: number },
): Promise<Map<number, SrGroupPrice>> {
  const unique = [
    ...new Set(
      productInnerIds.filter((n) => Number.isFinite(n) && n > 0).map(Math.trunc),
    ),
  ];
  const out = new Map<number, SrGroupPrice>();
  if (!unique.length) return out;

  const concurrency = Math.min(6, Math.max(1, opts?.concurrency ?? 4));
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const i = cursor++;
      const innerId = unique[i];
      try {
        const found = await findGroupPrice(
          config,
          customerGroupOuterId,
          productOuterIdFromInner(innerId),
        );
        if (found) out.set(innerId, found);
      } catch {
        /* egy termék hibája ne döntse el az oldalt */
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () =>
      worker(),
    ),
  );
  return out;
}

const groupPriceCountCache = new Map<
  string,
  { at: number; count: number }
>();
const GROUP_PRICE_COUNT_TTL_MS = 60_000;

export function invalidateGroupPriceCountCache(
  shopName?: string,
  customerGroupOuterId?: string,
): void {
  if (!shopName) {
    groupPriceCountCache.clear();
    return;
  }
  const prefix = `${shopName.toLowerCase()}:`;
  if (!customerGroupOuterId) {
    for (const k of groupPriceCountCache.keys()) {
      if (k.startsWith(prefix)) groupPriceCountCache.delete(k);
    }
    return;
  }
  groupPriceCountCache.delete(
    `${prefix}${customerGroupOuterId}`,
  );
}

export async function countGroupPrices(
  config: ShoprenterConfig,
  customerGroupOuterId: string,
): Promise<number> {
  const cacheKey = `${config.shopName.toLowerCase()}:${customerGroupOuterId}`;
  const hit = groupPriceCountCache.get(cacheKey);
  if (hit && Date.now() - hit.at < GROUP_PRICE_COUNT_TTL_MS) {
    return hit.count;
  }

  let total = 0;
  let page = 0;
  for (;;) {
    const qs = new URLSearchParams({
      full: "0",
      limit: "200",
      page: String(page),
      customerGroupId: customerGroupOuterId,
    });
    const res = await apiFetch(
      config,
      `/customerGroupProductPrices?${qs.toString()}`,
    );
    if (!res.ok) {
      throwFriendly("Csoportár szám", res.status, await res.text());
    }
    const data = (await res.json()) as {
      items?: unknown[];
      pageCount?: number | string;
      itemCount?: number | string;
    };
    const itemCount = toInt(data.itemCount);
    if (itemCount != null && page === 0) {
      groupPriceCountCache.set(cacheKey, { at: Date.now(), count: itemCount });
      return itemCount;
    }
    const n = data.items?.length ?? 0;
    total += n;
    const pageCount = toInt(data.pageCount) ?? 1;
    page += 1;
    if (page >= pageCount || n === 0) break;
    if (page > 50) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  groupPriceCountCache.set(cacheKey, { at: Date.now(), count: total });
  return total;
}

export async function upsertGroupPrice(
  config: ShoprenterConfig,
  opts: {
    customerGroupOuterId: string;
    productInnerId: number;
    priceNet: number;
    existingId?: string | null;
  },
): Promise<SrGroupPrice> {
  const price = Math.round(opts.priceNet);
  const productOuter = productOuterIdFromInner(opts.productInnerId);

  let existingId = opts.existingId ?? null;
  if (!existingId) {
    const found = await findGroupPrice(
      config,
      opts.customerGroupOuterId,
      productOuter,
    );
    existingId = found?.id ?? null;
  }

  if (existingId) {
    const res = await apiFetch(
      config,
      `/customerGroupProductPrices/${encodeURIComponent(existingId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ price: String(price) }),
      },
    );
    if (!res.ok) {
      throwFriendly("Csoportár mentés", res.status, await res.text());
    }
    invalidateGroupPriceCountCache(
      config.shopName,
      opts.customerGroupOuterId,
    );
    const data = (await res.json()) as Record<string, unknown>;
    const mapped = mapGroupPrice(data);
    if (mapped) return mapped;
    return {
      id: existingId,
      priceNet: price,
      productInnerId: opts.productInnerId,
      productOuterId: productOuter,
    };
  }

  const res = await apiFetch(config, `/customerGroupProductPrices`, {
    method: "POST",
    body: JSON.stringify({
      price: String(price),
      customerGroup: { id: opts.customerGroupOuterId },
      product: { id: productOuter },
    }),
  });
  if (!res.ok) {
    throwFriendly("Csoportár létrehozás", res.status, await res.text());
  }
  invalidateGroupPriceCountCache(config.shopName, opts.customerGroupOuterId);
  const data = (await res.json()) as Record<string, unknown>;
  const mapped = mapGroupPrice(data);
  if (mapped) return mapped;
  return {
    id: typeof data.id === "string" ? data.id : "",
    priceNet: price,
    productInnerId: opts.productInnerId,
    productOuterId: productOuter,
  };
}

export async function deleteGroupPrice(
  config: ShoprenterConfig,
  groupPriceId: string,
  opts?: { customerGroupOuterId?: string },
): Promise<void> {
  const res = await apiFetch(
    config,
    `/customerGroupProductPrices/${encodeURIComponent(groupPriceId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    throwFriendly("Csoportár törlés", res.status, await res.text());
  }
  invalidateGroupPriceCountCache(
    config.shopName,
    opts?.customerGroupOuterId,
  );
}
