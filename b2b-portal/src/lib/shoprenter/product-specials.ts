/**
 * Shoprenter productSpecials — mennyiségi sáv (P-06).
 * Csak minQuantity > 0, adott vevőcsoportra; nap-termék / dátumos akciót nem bántjuk.
 */

import {
  getAccessToken,
  getAuthMode,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { productOuterIdFromInner } from "@/lib/shoprenter/group-prices";

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
  const url = path.startsWith("http")
    ? path
    : `${baseUrl(config)}${path.startsWith("/") ? path : `/${path}`}`;
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

function collectionHref(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const href = (raw as Record<string, unknown>).href;
  return typeof href === "string" && href.trim() ? href.trim() : null;
}

/**
 * SR often returns productSpecials as { href } and items as { href } stubs
 * (no inline price/minQuantity). Follow hrefs to full records.
 */
async function loadProductSpecialRecords(
  config: ShoprenterConfig,
  productInnerId: number,
): Promise<Record<string, unknown>[]> {
  const productOuter = productOuterIdFromInner(productInnerId);
  const res = await apiFetch(
    config,
    `/products/${encodeURIComponent(productOuter)}?full=1`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throwFriendly("Sávok betöltése", res.status, text);
  }
  const item = (await res.json()) as Record<string, unknown>;

  let stubs = inlineCollectionItems(item.productSpecials);
  if (!stubs.length) {
    const href = collectionHref(item.productSpecials);
    if (href) {
      const colRes = await apiFetch(config, href);
      if (!colRes.ok) {
        const text = await colRes.text().catch(() => "");
        throwFriendly("Sávok lista", colRes.status, text);
      }
      stubs = inlineCollectionItems(await colRes.json());
    }
  }

  const out: Record<string, unknown>[] = [];
  for (const stub of stubs) {
    // Already a full special (has price + id)
    if (mapSpecial(stub)) {
      out.push(stub);
      continue;
    }
    const href = typeof stub.href === "string" ? stub.href : null;
    if (!href) continue;
    const one = await apiFetch(config, href);
    if (!one.ok) continue;
    const full = (await one.json()) as Record<string, unknown>;
    out.push(full);
    await new Promise((r) => setTimeout(r, 60));
  }
  return out;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
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

function customerGroupInnerFromRef(ref: unknown): number | null {
  if (!ref || typeof ref !== "object") return null;
  const r = ref as Record<string, unknown>;
  if (r.innerId != null) {
    const n = Number(r.innerId);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  const id = typeof r.id === "string" ? r.id : null;
  if (id) {
    const fromId = customerGroupInnerFromOuterId(id);
    if (fromId != null) return fromId;
  }
  const href = typeof r.href === "string" ? r.href : null;
  if (href) {
    const plain = href.match(/customer_group_id[=-](\d+)/i);
    if (plain) return Number(plain[1]);
    // Classic SR: .../customerGroups/<base64 outer id>
    const m = href.match(/\/customerGroups\/([^/?#]+)/i);
    if (m?.[1]) {
      try {
        return customerGroupInnerFromOuterId(decodeURIComponent(m[1]));
      } catch {
        return customerGroupInnerFromOuterId(m[1]);
      }
    }
  }
  return null;
}

function customerGroupInnerFromOuterId(outerId: string): number | null {
  try {
    const decoded = Buffer.from(outerId, "base64").toString("utf8");
    const m = decoded.match(/customer_group_id=(\d+)/i);
    if (m) return Number(m[1]);
  } catch {
    /* ignore */
  }
  if (/^\d+$/.test(outerId)) return Number(outerId);
  return null;
}

export type SrVolumeTier = {
  id: string;
  priceNet: number;
  minQty: number;
  maxQty: number | null;
  dateFrom: string | null;
  dateTo: string | null;
};

function mapSpecial(raw: Record<string, unknown>): SrVolumeTier | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const priceNet = toNumber(raw.price);
  if (!id || priceNet == null) return null;
  const type = typeof raw.type === "string" ? raw.type : "";
  if (type === "day_spec") return null;
  const minQty = Math.max(0, Math.round(toNumber(raw.minQuantity) ?? 0));
  if (minQty <= 0) return null; // nem mennyiségi sáv
  const maxRaw = toNumber(raw.maxQuantity) ?? 0;
  const maxQty = maxRaw > 0 ? Math.round(maxRaw) : null;
  return {
    id,
    priceNet: Math.round(priceNet),
    minQty,
    maxQty,
    dateFrom:
      typeof raw.dateFrom === "string" && !raw.dateFrom.startsWith("0000")
        ? raw.dateFrom
        : null,
    dateTo:
      typeof raw.dateTo === "string" && !raw.dateTo.startsWith("0000")
        ? raw.dateTo
        : null,
  };
}

function inlineCollectionItems(
  raw: unknown,
): Record<string, unknown>[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.items)) {
    return o.items.filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object",
    );
  }
  if (Array.isArray(raw)) {
    return raw.filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object",
    );
  }
  return [];
}

/**
 * Mennyiségi sávok egy termék × vevőcsoport párosra (SR product + filter).
 */
export async function listVolumeTiersForProductGroup(
  config: ShoprenterConfig,
  productInnerId: number,
  customerGroupOuterId: string,
): Promise<SrVolumeTier[]> {
  const groupInner = customerGroupInnerFromOuterId(customerGroupOuterId);
  const specials = await loadProductSpecialRecords(config, productInnerId);
  const out: SrVolumeTier[] = [];
  for (const sp of specials) {
    const mapped = mapSpecial(sp);
    if (!mapped) continue;
    const spGid = customerGroupInnerFromRef(sp.customerGroup);
    if (groupInner != null && spGid != null && spGid !== groupInner) continue;
    // ha a specialnek nincs csoportja → mindenki — nem mi kezeljük volume UI-ból
    if (spGid == null) continue;
    out.push(mapped);
  }
  out.sort((a, b) => a.minQty - b.minQty);
  // Dedup minQty — korábbi hibás replace hagyhatott duplikátumokat SR-ben
  const byMin = new Map<number, SrVolumeTier>();
  for (const t of out) {
    const prev = byMin.get(t.minQty);
    if (!prev || t.priceNet < prev.priceNet) byMin.set(t.minQty, t);
  }
  return [...byMin.values()].sort((a, b) => a.minQty - b.minQty);
}

export async function deleteProductSpecial(
  config: ShoprenterConfig,
  specialId: string,
): Promise<void> {
  const res = await apiFetch(
    config,
    `/productSpecials/${encodeURIComponent(specialId)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throwFriendly("Sáv törlése", res.status, text);
  }
}

export async function createVolumeTier(
  config: ShoprenterConfig,
  input: {
    productInnerId: number;
    customerGroupOuterId: string;
    priceNet: number;
    minQty: number;
    maxQty?: number | null;
    priority?: number;
  },
): Promise<SrVolumeTier> {
  const productOuter = productOuterIdFromInner(input.productInnerId);
  const body = {
    priority: String(input.priority ?? 1),
    price: String(Math.round(input.priceNet)),
    minQuantity: String(Math.max(1, Math.round(input.minQty))),
    maxQuantity:
      input.maxQty != null && input.maxQty > 0
        ? String(Math.round(input.maxQty))
        : "0",
    product: { id: productOuter },
    customerGroup: { id: input.customerGroupOuterId },
  };
  const res = await apiFetch(config, `/productSpecials`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throwFriendly("Sáv létrehozása", res.status, text);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const mapped = mapSpecial(raw);
  if (!mapped) {
    return {
      id: typeof raw.id === "string" ? raw.id : "",
      priceNet: Math.round(input.priceNet),
      minQty: Math.max(1, Math.round(input.minQty)),
      maxQty:
        input.maxQty != null && input.maxQty > 0
          ? Math.round(input.maxQty)
          : null,
      dateFrom: null,
      dateTo: null,
    };
  }
  return mapped;
}

/**
 * Cseréli a csoport mennyiségi sávjait: törli a régieket, létrehozza az újakat.
 */
export async function replaceVolumeTiers(
  config: ShoprenterConfig,
  input: {
    productInnerId: number;
    customerGroupOuterId: string;
    tiers: { minQty: number; priceNet: number; maxQty?: number | null }[];
  },
): Promise<SrVolumeTier[]> {
  const existing = await listVolumeTiersForProductGroup(
    config,
    input.productInnerId,
    input.customerGroupOuterId,
  );
  for (const sp of existing) {
    await deleteProductSpecial(config, sp.id);
    await new Promise((r) => setTimeout(r, 80));
  }

  const created: SrVolumeTier[] = [];
  const sorted = [...input.tiers]
    .filter((t) => t.minQty > 0 && Number.isFinite(t.priceNet) && t.priceNet >= 0)
    .sort((a, b) => a.minQty - b.minQty);

  for (const t of sorted) {
    const row = await createVolumeTier(config, {
      productInnerId: input.productInnerId,
      customerGroupOuterId: input.customerGroupOuterId,
      priceNet: t.priceNet,
      minQty: t.minQty,
      maxQty: t.maxQty ?? null,
    });
    created.push(row);
    await new Promise((r) => setTimeout(r, 120));
  }
  return created;
}
