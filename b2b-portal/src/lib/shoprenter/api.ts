import {
  effectiveNet as calcEffectiveNet,
  findNextTier,
  listActiveTiers,
  netToGross,
} from "@/lib/merchant/pricing-engine";
import { fetchWithTimeout } from "@/lib/shoprenter/http";

export type ShoprenterConfig = {
  shopName: string;
  /** OAuth custom API client (preferred / App Store path) */
  clientId?: string;
  clientSecret?: string;
  /** Legacy Basic Auth (Beállítások → API: Felhasználónév / Jelszó) */
  username?: string;
  password?: string;
  /** Storefront base URL override (from shops.store_url) */
  storeUrl?: string;
};

export type AuthMode = "oauth" | "basic";

export type ResolvedProduct = {
  sku: string;
  productId: number | null;
  resourceId?: string;
  name?: string;
  modelNumber?: string;
  gtin?: string;
  /** Lista / effektív egységár nettó (Shoprenter `price` általában nettó) */
  price?: number;
  priceFormatted?: string;
  priceNet?: number;
  priceGross?: number;
  priceNetFormatted?: string;
  priceGrossFormatted?: string;
  /**
   * Beszerzési / költség nettó (Shoprenter `cost`).
   * Gyakran üres — csak ha a bolt kitöltötte.
   */
  costNet?: number;
  costNetFormatted?: string;
  hasCost?: boolean;
  listPriceNet?: number;
  listPriceGross?: number;
  listPriceNetFormatted?: string;
  listPriceGrossFormatted?: string;
  vatRate?: number;
  vatAmount?: number;
  vatAmountFormatted?: string;
  /** Aktív akció / kedvezményes nettó, ha van */
  specialPriceNet?: number;
  discountPercent?: number;
  discountAmountNet?: number;
  discountAmountNetFormatted?: string;
  priceSource?: "list" | "special" | "group" | "percent" | "own" | "tier";
  /** Mennyiségi sávok (csoport-szűrt), UI ladder. */
  tiers?: { minQty: number; priceNet: number; priceGrossFormatted?: string }[];
  /** Következő olcsóbb sáv (FOMO nudge). */
  nextTier?: {
    minQty: number;
    missingQty: number;
    priceNet: number;
    priceGrossFormatted: string;
    savePct: number;
    near: boolean;
  } | null;
  /** Összes raktár (stock1…4) */
  stockQty?: number;
  stock1?: number;
  stock2?: number;
  stock3?: number;
  stock4?: number;
  orderable?: boolean;
  inStock?: boolean;
  /** pl. "Készleten: 5 db" / "Nincs raktáron, rendelhető" */
  stockLabel?: string;
  stockTone?: "ok" | "low" | "out" | "blocked";
  imageUrl?: string;
  /** Storefront product page (when productId known) */
  productUrl?: string;
  /** Shoprenter minimalOrderNumber */
  minQty?: number;
  /** Pack step: multiples of min when minimalOrderNumberMultiply is on */
  qtyStep?: number;
  /** maximalOrderNumber; null/undefined = no max */
  maxQty?: number | null;
  /** e.g. "×6-osával" / "min. 6 db" */
  packLabel?: string;
  found: boolean;
  error?: string;
};

type TokenCache = { token: string; expiresAt: number };

/** Per-shop OAuth token cache (multi-tenant safe). */
const tokenCaches = new Map<string, TokenCache>();

function tokenCacheKey(config: ShoprenterConfig): string {
  return `${config.shopName}:${config.clientId ?? "basic"}`;
}

export function getShoprenterConfigFromEnv(): ShoprenterConfig {
  const shopName = process.env.SHOPRENTER_SHOP_NAME?.trim();
  if (!shopName) {
    throw new Error("Missing SHOPRENTER_SHOP_NAME");
  }

  const clientId = process.env.SHOPRENTER_CLIENT_ID?.trim() || undefined;
  const clientSecret = process.env.SHOPRENTER_CLIENT_SECRET?.trim() || undefined;
  const username = process.env.SHOPRENTER_USERNAME?.trim() || undefined;
  const password = process.env.SHOPRENTER_PASSWORD?.trim() || undefined;

  const hasOAuth = Boolean(clientId && clientSecret);
  const hasBasic = Boolean(username && password);

  if (!hasOAuth && !hasBasic) {
    throw new Error(
      "Set either SHOPRENTER_CLIENT_ID+SECRET (OAuth) or SHOPRENTER_USERNAME+PASSWORD (legacy Basic)",
    );
  }

  return { shopName, clientId, clientSecret, username, password };
}

export function getAuthMode(config: ShoprenterConfig): AuthMode {
  if (config.clientId && config.clientSecret) return "oauth";
  return "basic";
}

/** Public storefront base (no trailing slash). Prefer config.storeUrl, then SHOPRENTER_STORE_URL. */
export function storefrontBaseUrl(config: ShoprenterConfig): string {
  const fromConfig = config.storeUrl?.trim();
  if (fromConfig) return fromConfig.replace(/\/+$/, "");
  const fromEnv = process.env.SHOPRENTER_STORE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return `https://${config.shopName}.shoprenter.hu`;
}

export function storefrontProductUrl(
  config: ShoprenterConfig,
  productId: number | null | undefined,
): string | undefined {
  if (productId == null || !Number.isFinite(productId) || productId <= 0) {
    return undefined;
  }
  return `${storefrontBaseUrl(config)}/index.php?route=product/product&product_id=${Math.round(productId)}`;
}

/** API2 + Bearer (OAuth) */
export function api2BaseUrl(shopName: string): string {
  return `https://${shopName}.api2.myshoprenter.hu/api`;
}

/** Classic API + Basic (legacy credentials screen) */
export function apiClassicBaseUrl(shopName: string): string {
  return `https://${shopName}.api.myshoprenter.hu`;
}

export async function getAccessToken(
  config: ShoprenterConfig,
): Promise<string> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("OAuth client credentials not configured");
  }

  const now = Date.now();
  const key = tokenCacheKey(config);
  const cached = tokenCaches.get(key);
  if (cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const res = await fetch(
    `https://oauth.app.shoprenter.net/${config.shopName}/app/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  tokenCaches.set(key, {
    token: data.access_token,
    expiresAt: now + expiresInMs,
  });

  return data.access_token;
}

function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString(
    "base64",
  );
  return `Basic ${token}`;
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

  return {
    Authorization: basicAuthHeader(config.username, config.password),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function baseUrl(config: ShoprenterConfig): string {
  return getAuthMode(config) === "oauth"
    ? api2BaseUrl(config.shopName)
    : apiClassicBaseUrl(config.shopName);
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
      headers: {
        ...headers,
        ...(init?.headers ?? {}),
      },
    },
    { pathLabel: path },
  );
}

export const PRODUCTS_PAGE_LIMIT = 200;

export type ProductsPageResult =
  | {
      ok: true;
      items: Record<string, unknown>[];
      pageCount: number;
    }
  | { ok: false; status: number; body: string };

/** Shoprenter manufacturer_id a href / base64 id-ből. */
export function parseManufacturerInnerId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  if (typeof raw !== "object") return null;
  const obj = raw as {
    innerId?: unknown;
    href?: string;
    id?: string;
  };
  const fromInner = toNumber(obj.innerId);
  if (fromInner != null && fromInner > 0) return Math.round(fromInner);
  const token =
    (typeof obj.href === "string" && obj.href) ||
    (typeof obj.id === "string" && obj.id) ||
    "";
  if (!token) return null;
  const leaf = token.includes("/") ? token.split("/").pop()! : token;
  try {
    const decoded = Buffer.from(leaf, "base64").toString("utf8");
    const m = decoded.match(/manufacturer_id=(\d+)/i);
    if (m) return Number(m[1]);
  } catch {
    /* ignore */
  }
  const m2 = token.match(/manufacturer_id[=-](\d+)/i);
  return m2 ? Number(m2[1]) : null;
}

export type ManufacturerRef = {
  innerId: number;
  name: string | null;
};

/** Termék manufacturer mező → innerId + név (ha expanded). */
export function pickManufacturerRef(
  item: Record<string, unknown>,
  nameByInner?: Map<number, string>,
): ManufacturerRef | null {
  const m = item.manufacturer;
  const innerId = parseManufacturerInnerId(m);
  if (innerId == null) return null;
  let name: string | null = null;
  if (m && typeof m === "object") {
    const n = (m as { name?: unknown }).name;
    if (typeof n === "string" && n.trim()) name = n.trim();
  }
  if (!name && nameByInner?.has(innerId)) {
    name = nameByInner.get(innerId) ?? null;
  }
  return { innerId, name };
}

/** Összes gyártó: innerId → név (árazás szűrő + sync). */
export async function fetchManufacturersMap(
  config: ShoprenterConfig,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  let page = 0;
  const limit = 200;
  for (let guard = 0; guard < 40; guard++) {
    const res = await apiFetch(
      config,
      `/manufacturers?page=${page}&limit=${limit}&full=1`,
    );
    if (!res.ok) break;
    let data: {
      items?: Record<string, unknown>[];
      pageCount?: number;
    };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      break;
    }
    const items = data.items ?? [];
    for (const item of items) {
      const id = parseManufacturerInnerId(item);
      if (id == null) continue;
      const name =
        typeof item.name === "string" && item.name.trim()
          ? item.name.trim()
          : null;
      if (name) out.set(id, name);
      else if (!out.has(id)) out.set(id, `Gyártó #${id}`);
    }
    const pageCount =
      typeof data.pageCount === "number" && data.pageCount > 0
        ? data.pageCount
        : page + 1;
    page++;
    if (items.length === 0 || page >= pageCount) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}

/** Shoprenter category_id a href / base64 id-ből. */
export function parseCategoryInnerId(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  if (typeof raw !== "object") return null;
  const obj = raw as {
    innerId?: unknown;
    href?: string;
    id?: string;
  };
  const fromInner = toNumber(obj.innerId);
  if (fromInner != null && fromInner > 0) return Math.round(fromInner);
  const token =
    (typeof obj.href === "string" && obj.href) ||
    (typeof obj.id === "string" && obj.id) ||
    "";
  if (!token) return null;
  const leaf = token.includes("/") ? token.split("/").pop()! : token;
  try {
    const decoded = Buffer.from(leaf, "base64").toString("utf8");
    const m = decoded.match(/category_id=(\d+)/i);
    if (m) return Number(m[1]);
  } catch {
    /* ignore */
  }
  const m2 = token.match(/category_id[=-](\d+)/i);
  return m2 ? Number(m2[1]) : null;
}

export type CategoryMeta = {
  innerId: number;
  name: string;
  parentInnerId: number | null;
};

function relationCollectionItems(
  collection: unknown,
): Record<string, unknown>[] {
  if (!collection) return [];
  if (Array.isArray(collection)) {
    return collection.filter(
      (it): it is Record<string, unknown> => !!it && typeof it === "object",
    );
  }
  if (typeof collection !== "object") return [];
  const col = collection as { items?: unknown[] };
  if (!Array.isArray(col.items)) return [];
  return col.items.filter(
    (it): it is Record<string, unknown> => !!it && typeof it === "object",
  );
}

function decodeResourceLeaf(token: string): string | null {
  const leaf = token.includes("/") ? token.split("/").pop()! : token;
  if (!leaf) return null;
  try {
    return Buffer.from(leaf, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export type ProductCategoryLink = {
  productInnerId: number;
  categoryInnerId: number;
};

/**
 * productCategory relation href/id → product_id + category_id
 * pl. productCategory-product_id=49&category_id=20
 */
export function parseProductCategoryRelationPair(
  raw: unknown,
): ProductCategoryLink | null {
  if (raw == null) return null;

  if (typeof raw === "string") {
    const decoded = decodeResourceLeaf(raw) ?? raw;
    const pm = decoded.match(/product_id=(\d+)/i);
    const cm = decoded.match(/category_id=(\d+)/i);
    if (pm && cm) {
      return {
        productInnerId: Number(pm[1]),
        categoryInnerId: Number(cm[1]),
      };
    }
    return null;
  }

  if (typeof raw !== "object") return null;
  const obj = raw as {
    href?: string;
    id?: string;
    product?: unknown;
    category?: unknown;
    productId?: unknown;
    categoryId?: unknown;
    innerId?: unknown;
  };

  const fromHref =
    (typeof obj.href === "string" && parseProductCategoryRelationPair(obj.href)) ||
    (typeof obj.id === "string" && parseProductCategoryRelationPair(obj.id)) ||
    null;
  if (fromHref) return fromHref;

  const productInnerId =
    parseProductInnerIdLoose(obj.product) ??
    (typeof obj.productId === "number" || typeof obj.productId === "string"
      ? Number(obj.productId)
      : null);
  const categoryInnerId =
    parseCategoryInnerId(obj.category) ??
    (typeof obj.categoryId === "number" || typeof obj.categoryId === "string"
      ? Number(obj.categoryId)
      : null);

  if (
    productInnerId != null &&
    Number.isFinite(productInnerId) &&
    productInnerId > 0 &&
    categoryInnerId != null &&
    categoryInnerId > 0
  ) {
    return {
      productInnerId: Math.round(productInnerId),
      categoryInnerId: Math.round(categoryInnerId),
    };
  }
  return null;
}

function parseProductInnerIdLoose(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number(raw.trim());
  }
  if (typeof raw !== "object") return null;
  const obj = raw as { innerId?: unknown; href?: string; id?: string };
  const fromInner =
    typeof obj.innerId === "number" || typeof obj.innerId === "string"
      ? Number(obj.innerId)
      : NaN;
  if (Number.isFinite(fromInner) && fromInner > 0) return Math.round(fromInner);
  const token =
    (typeof obj.href === "string" && obj.href) ||
    (typeof obj.id === "string" && obj.id) ||
    "";
  if (!token) return null;
  const decoded = decodeResourceLeaf(token);
  if (!decoded) return null;
  const m = decoded.match(/product_id=(\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Shoprenter kategória megjelenő neve — categoryDescriptions[].name
 * (a /categories resource-nak nincs top-level name mezője; lásd categoryExtend).
 * Preferált: language_id=1 (HU), majd első nem üres név.
 */
export function pickCategoryDisplayName(
  item: Record<string, unknown>,
): string | undefined {
  if (typeof item.name === "string" && item.name.trim()) {
    return item.name.trim();
  }

  const descs = item.categoryDescriptions;
  const list: Record<string, unknown>[] = Array.isArray(descs)
    ? descs.filter(
        (d): d is Record<string, unknown> => !!d && typeof d === "object",
      )
    : relationCollectionItems(descs);

  let fallback: string | undefined;
  for (const d of list) {
    const n = typeof d.name === "string" ? d.name.trim() : "";
    if (!n) continue;
    const lang = d.language;
    let langInner: unknown;
    if (lang && typeof lang === "object") {
      langInner = (lang as { innerId?: unknown }).innerId;
      if (langInner == null) {
        const href =
          (typeof (lang as { href?: string }).href === "string" &&
            (lang as { href: string }).href) ||
          (typeof (lang as { id?: string }).id === "string" &&
            (lang as { id: string }).id) ||
          "";
        if (href) {
          const decoded = decodeResourceLeaf(href);
          const m = decoded?.match(/language_id=(\d+)/i);
          if (m) langInner = m[1];
        }
      }
    }
    if (langInner === 1 || langInner === "1") return n;
    if (!fallback) fallback = n;
  }
  return fallback;
}

/** Termék → category inner id lista (productCategoryRelations / categories). */
export function pickCategoryInnerIds(
  item: Record<string, unknown>,
): number[] {
  const ids = new Set<number>();
  const relations = relationCollectionItems(item.productCategoryRelations);
  for (const rel of relations) {
    const pair = parseProductCategoryRelationPair(rel);
    if (pair) {
      ids.add(pair.categoryInnerId);
      continue;
    }
    const id =
      parseCategoryInnerId(rel.category) ?? parseCategoryInnerId(rel);
    if (id != null) ids.add(id);
  }
  const cats = item.categories;
  if (Array.isArray(cats)) {
    for (const c of cats) {
      const id = parseCategoryInnerId(c);
      if (id != null) ids.add(id);
    }
  } else {
    for (const c of relationCollectionItems(cats)) {
      const id = parseCategoryInnerId(c);
      if (id != null) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Összes termék↔kategória link a Shoprenter productCategoryRelations resource-ból.
 * A /products lista csak href stubot ad — ez a M:N forrás.
 */
export async function fetchProductCategoryLinks(
  config: ShoprenterConfig,
): Promise<ProductCategoryLink[]> {
  const out: ProductCategoryLink[] = [];
  const seen = new Set<string>();
  let page = 0;
  const limit = 200;
  let useFull = true;

  for (let guard = 0; guard < 500; guard++) {
    const q = useFull
      ? `/productCategoryRelations?page=${page}&limit=${limit}&full=1`
      : `/productCategoryRelations?page=${page}&limit=${limit}`;
    const res = await apiFetch(config, q);
    if (!res.ok) {
      if (useFull && page === 0) {
        useFull = false;
        continue;
      }
      break;
    }
    let data: {
      items?: unknown[];
      pageCount?: number;
    };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      break;
    }
    const items = data.items ?? [];
    for (const it of items) {
      const pair = parseProductCategoryRelationPair(it);
      if (!pair) continue;
      const key = `${pair.productInnerId}:${pair.categoryInnerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pair);
    }
    const pageCount =
      typeof data.pageCount === "number" && data.pageCount > 0
        ? data.pageCount
        : page + 1;
    page++;
    if (items.length === 0 || page >= pageCount) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}


function ingestCategoryPageItems(
  items: Record<string, unknown>[],
  out: Map<number, CategoryMeta>,
): void {
  for (const item of items) {
    const id = parseCategoryInnerId(item);
    if (id == null) continue;
    const name = pickCategoryDisplayName(item) ?? "";
    const parentInnerId =
      parseCategoryInnerId(item.parentCategory) ??
      parseCategoryInnerId(item.parent) ??
      null;
    const prev = out.get(id);
    out.set(id, {
      innerId: id,
      name: name || prev?.name || "",
      parentInnerId:
        parentInnerId != null && parentInnerId !== id
          ? parentInnerId
          : (prev?.parentInnerId ?? null),
    });
  }
}

/**
 * Összes kategória: innerId → név + parent (árazás szűrő + sync).
 * Preferált forrás: /categoryExtend (beágyazott categoryDescriptions.name).
 * Kiegészítés: /categoryDescriptions ha a név még hiányzik.
 */
export async function fetchCategoriesMap(
  config: ShoprenterConfig,
): Promise<Map<number, CategoryMeta>> {
  const out = new Map<number, CategoryMeta>();
  const limit = 200;

  const fetchPaged = async (pathBase: string): Promise<boolean> => {
    let page = 0;
    let anyOk = false;
    for (let guard = 0; guard < 80; guard++) {
      const res = await apiFetch(
        config,
        `${pathBase}?page=${page}&limit=${limit}&full=1`,
      );
      if (!res.ok) break;
      anyOk = true;
      let data: {
        items?: Record<string, unknown>[];
        pageCount?: number;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        break;
      }
      const items = data.items ?? [];
      ingestCategoryPageItems(items, out);
      const pageCount =
        typeof data.pageCount === "number" && data.pageCount > 0
          ? data.pageCount
          : page + 1;
      page++;
      if (items.length === 0 || page >= pageCount) break;
      await new Promise((r) => setTimeout(r, 80));
    }
    return anyOk;
  };

  // categoryExtend: név a categoryDescriptions-ben (SR docs)
  const extendOk = await fetchPaged("/categoryExtend");
  if (!extendOk) {
    await fetchPaged("/categories");
  }

  const missingNames = [...out.values()].some((c) => !c.name);
  if (missingNames || out.size === 0) {
    // categoryDescriptions resource: name + category href
    let page = 0;
    for (let guard = 0; guard < 80; guard++) {
      const res = await apiFetch(
        config,
        `/categoryDescriptions?page=${page}&limit=${limit}&full=1`,
      );
      if (!res.ok) break;
      let data: {
        items?: Record<string, unknown>[];
        pageCount?: number;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        break;
      }
      const items = data.items ?? [];
      for (const item of items) {
        const catId = parseCategoryInnerId(item.category);
        if (catId == null) continue;
        const name =
          typeof item.name === "string" && item.name.trim()
            ? item.name.trim()
            : "";
        if (!name) continue;
        const lang = item.language;
        let prefer = false;
        if (lang && typeof lang === "object") {
          const li = (lang as { innerId?: unknown }).innerId;
          prefer = li === 1 || li === "1";
        }
        const prev = out.get(catId);
        if (!prev) {
          out.set(catId, {
            innerId: catId,
            name,
            parentInnerId: null,
          });
        } else if (!prev.name || prefer) {
          out.set(catId, { ...prev, name });
        }
      }
      const pageCount =
        typeof data.pageCount === "number" && data.pageCount > 0
          ? data.pageCount
          : page + 1;
      page++;
      if (items.length === 0 || page >= pageCount) break;
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  // Név nélküli rekord: üres string — a UI `Kategória #id` fallbackot mutat;
  // placeholder ne kerüljön a DB-be (felülírná a későbbi jó nevet).
  return out;
}

/** Full product page for catalog sync (full=1 — full=0 csak href stub). */
export async function fetchProductsPage(
  config: ShoprenterConfig,
  page: number,
  limit = PRODUCTS_PAGE_LIMIT,
): Promise<ProductsPageResult> {
  const res = await apiFetch(
    config,
    `/products?page=${page}&limit=${limit}&full=1`,
  );
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, body: body.slice(0, 400) };
  }
  let data: { items?: Record<string, unknown>[]; pageCount?: number };
  try {
    data = JSON.parse(body) as {
      items?: Record<string, unknown>[];
      pageCount?: number;
    };
  } catch {
    return { ok: false, status: 502, body: "Invalid JSON from Shoprenter" };
  }
  const pageCount =
    typeof data.pageCount === "number" && data.pageCount > 0
      ? data.pageCount
      : page + 1;
  return { ok: true, items: data.items ?? [], pageCount };
}

export function formatHuf(amount: number): string {
  try {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} Ft`;
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

export function buildProductImageUrl(
  shopName: string,
  mainPicture: unknown,
): string | undefined {
  if (typeof mainPicture !== "string" || !mainPicture.trim()) return undefined;
  const path = mainPicture.replace(/^\//, "");
  if (/^https?:\/\//i.test(path)) return path;
  // CDN /custom/{shop}/ path is case-sensitive; live themes use lowercase.
  const slug = shopName.trim().toLowerCase();
  return `https://${slug}.cdn.shoprenter.hu/custom/${slug}/image/cache/w200h200q100/${path}`;
}

/** taxClass href → ÁFA % (pl. 27) */
const vatRateCache = new Map<string, number>();

function parseVatPercent(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function resolveVatRate(
  _config: ShoprenterConfig,
  taxClass: unknown,
): number | undefined {
  if (!taxClass || typeof taxClass !== "object") return 27;
  const tc = taxClass as { href?: string; name?: string; rate?: unknown };
  if (typeof tc.name === "string") {
    const fromName = parseVatPercent(tc.name);
    if (fromName != null) return fromName;
  }
  const href = tc.href;
  if (href && vatRateCache.has(href)) return vatRateCache.get(href);
  // Skip taxClass href waterfall (2–3 Shoprenter roundtrips). HU B2B default.
  if (href) vatRateCache.set(href, 27);
  return 27;
}

function inlineCollectionItems(
  collection: unknown,
): Record<string, unknown>[] {
  if (!collection || typeof collection !== "object") return [];
  const col = collection as { items?: Record<string, unknown>[] };
  if (!Array.isArray(col.items)) return [];
  return col.items.filter(
    (it) => it && typeof it === "object" && typeof it.price !== "undefined",
  );
}

async function fetchCollectionItems(
  config: ShoprenterConfig,
  collection: unknown,
): Promise<Record<string, unknown>[]> {
  if (!collection || typeof collection !== "object") return [];
  const col = collection as {
    href?: string;
    items?: Record<string, unknown>[];
  };
  if (Array.isArray(col.items) && col.items.length) {
    const headers = await authHeaders(config);
    const out: Record<string, unknown>[] = [];
    for (const it of col.items) {
      if (it && typeof it.price !== "undefined") {
        out.push(it);
        continue;
      }
      if (typeof it?.href === "string") {
        try {
          const res = await fetch(it.href, { headers, cache: "no-store" });
          if (res.ok) out.push((await res.json()) as Record<string, unknown>);
        } catch {
          /* skip */
        }
      }
    }
    return out;
  }
  if (!col.href) return [];
  try {
    const headers = await authHeaders(config);
    const res = await fetch(col.href, { headers, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
    };
    if (!data.items?.length) return [];
    return fetchCollectionItems(config, data);
  } catch {
    return [];
  }
}

function applyPriceBreakdown(
  product: ResolvedProduct,
  listNet: number | undefined,
  effectiveNet: number | undefined,
  vatRate: number | undefined,
  source: ResolvedProduct["priceSource"],
): ResolvedProduct {
  if (effectiveNet == null && listNet == null) return product;

  const list = listNet ?? effectiveNet!;
  const effective = effectiveNet ?? listNet!;
  const vat = vatRate ?? 27;
  const gross = Math.round(effective * (1 + vat / 100));
  const listGross = Math.round(list * (1 + vat / 100));
  const vatAmount = Math.round(gross - effective);
  const discountNet =
    list > effective + 0.5 ? Math.round(list - effective) : undefined;
  const discountPercent =
    discountNet != null && list > 0
      ? Math.round((discountNet / list) * 1000) / 10
      : undefined;

  return {
    ...product,
    price: effective,
    priceFormatted: formatHuf(gross),
    priceNet: Math.round(effective),
    priceGross: gross,
    priceNetFormatted: formatHuf(Math.round(effective)),
    priceGrossFormatted: formatHuf(gross),
    listPriceNet: Math.round(list),
    listPriceGross: listGross,
    listPriceNetFormatted: formatHuf(Math.round(list)),
    listPriceGrossFormatted: formatHuf(listGross),
    vatRate: vat,
    vatAmount,
    vatAmountFormatted: formatHuf(vatAmount),
    specialPriceNet:
      source === "special" ||
      source === "group" ||
      source === "own" ||
      source === "tier" ||
      source === "percent"
        ? Math.round(effective)
        : undefined,
    discountPercent,
    discountAmountNet: discountNet,
    discountAmountNetFormatted:
      discountNet != null ? formatHuf(discountNet) : undefined,
    priceSource: source ?? "list",
  };
}

const groupPercentCache = new Map<
  string,
  { at: number; byInner: Map<number, number | null> }
>();
const GROUP_PCT_TTL_MS = 45_000;

async function lookupGroupPercentDiscount(
  config: ShoprenterConfig,
  customerGroupInnerId: number,
): Promise<number | null> {
  const key = config.shopName.toLowerCase();
  const hit = groupPercentCache.get(key);
  if (hit && Date.now() - hit.at < GROUP_PCT_TTL_MS) {
    return hit.byInner.get(customerGroupInnerId) ?? null;
  }

  const byInner = new Map<number, number | null>();
  let page = 0;
  for (;;) {
    const res = await apiFetch(
      config,
      `/customerGroups?full=1&limit=100&page=${page}`,
    );
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
      pageCount?: number | string;
    };
    for (const item of data.items ?? []) {
      const inner =
        typeof item.innerId === "number"
          ? item.innerId
          : typeof item.innerId === "string"
            ? Number(item.innerId)
            : NaN;
      if (!Number.isFinite(inner)) continue;
      const pct = toNumber(item.percentDiscount);
      byInner.set(
        Math.trunc(inner),
        pct != null && pct > 0 ? Math.trunc(pct) : null,
      );
    }
    const pageCount =
      typeof data.pageCount === "number"
        ? data.pageCount
        : Number(data.pageCount) || 1;
    page += 1;
    if (page >= pageCount || !(data.items?.length)) break;
    if (page > 50) break;
  }
  groupPercentCache.set(key, { at: Date.now(), byInner });
  return byInner.get(customerGroupInnerId) ?? null;
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
    try {
      const decoded = Buffer.from(id, "base64").toString("utf8");
      const m = decoded.match(/customer_group_id=(\d+)/i);
      if (m) return Number(m[1]);
    } catch {
      /* ignore */
    }
    if (/^\d+$/.test(id)) return Number(id);
  }
  const href = typeof r.href === "string" ? r.href : null;
  if (href) {
    const plain = href.match(/customer_group_id[=-](\d+)/i);
    if (plain) return Number(plain[1]);
    const m = href.match(/\/customerGroups\/([^/?#]+)/i);
    if (m?.[1]) {
      try {
        const decoded = Buffer.from(
          decodeURIComponent(m[1]),
          "base64",
        ).toString("utf8");
        const gm = decoded.match(/customer_group_id=(\d+)/i);
        if (gm) return Number(gm[1]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

async function enrichPricing(
  config: ShoprenterConfig,
  product: ResolvedProduct,
  item: Record<string, unknown>,
  customerGroupInnerId?: number | null,
  qty = 1,
): Promise<ResolvedProduct> {
  const listNet = toNumber(item.price) ?? product.price ?? 0;
  const vatRate = await resolveVatRate(config, item.taxClass);
  const qtySafe = Math.max(1, Math.round(Number(qty) || 1));

  let ownGroupNet: number | null = null;
  if (customerGroupInnerId != null && Number.isFinite(customerGroupInnerId)) {
    const groupPrices = inlineCollectionItems(item.customerGroupProductPrices);
    let bestGroup: number | undefined;
    for (const gp of groupPrices) {
      const p = toNumber(gp.price);
      if (p == null) continue;
      let gid = customerGroupInnerFromRef(gp.customerGroup);
      if (gid == null) {
        const cg = gp.customerGroup as
          | { innerId?: string | number; href?: string }
          | undefined;
        if (cg?.innerId != null) gid = Number(cg.innerId);
      }
      if (gid !== customerGroupInnerId) continue;
      if (bestGroup == null || p < bestGroup) bestGroup = p;
    }
    if (bestGroup != null) ownGroupNet = bestGroup;
  }

  // productSpecials gyakran csak { href } / stub items — fetchCollectionItems követi
  let specialsRaw = inlineCollectionItems(item.productSpecials);
  if (!specialsRaw.length && item.productSpecials) {
    try {
      specialsRaw = await fetchCollectionItems(config, item.productSpecials);
    } catch {
      specialsRaw = [];
    }
  }

  const specials = specialsRaw
    .map((sp) => {
      const p = toNumber(sp.price);
      if (p == null) return null;
      const spGid = customerGroupInnerFromRef(sp.customerGroup);
      if (
        customerGroupInnerId != null &&
        Number.isFinite(customerGroupInnerId)
      ) {
        // Csak a vevő csoportja; csoport nélküli specialt kihagyjuk (volume UI)
        if (spGid == null || spGid !== customerGroupInnerId) return null;
      }
      const minQ = toNumber(sp.minQuantity) ?? 0;
      const maxQ = toNumber(sp.maxQuantity) ?? 0;
      return {
        price: p,
        minQty: Math.max(0, Math.round(minQ)),
        maxQty: maxQ > 0 ? Math.round(maxQ) : null,
        dateFrom:
          typeof sp.dateFrom === "string"
            ? sp.dateFrom
            : typeof sp.dateStart === "string"
              ? sp.dateStart
              : null,
        dateTo:
          typeof sp.dateTo === "string"
            ? sp.dateTo
            : typeof sp.dateEnd === "string"
              ? sp.dateEnd
              : null,
      };
    })
    .filter(Boolean) as {
    price: number;
    minQty: number;
    maxQty: number | null;
    dateFrom: string | null;
    dateTo: string | null;
  }[];

  let groupPercent: number | null = null;
  if (customerGroupInnerId != null && Number.isFinite(customerGroupInnerId)) {
    try {
      groupPercent = await lookupGroupPercentDiscount(
        config,
        customerGroupInnerId,
      );
    } catch {
      groupPercent = null;
    }
  }

  const result = calcEffectiveNet({
    listNet,
    groupPercent,
    ownGroupNet,
    specials,
    qty: qtySafe,
  });

  const sourceMap: Record<
    string,
    NonNullable<ResolvedProduct["priceSource"]>
  > = {
    own: "own",
    tier: "tier",
    percent: "percent",
    list: "list",
    special: "special",
  };
  const source = sourceMap[result.source] ?? "list";

  const vat = vatRate ?? 27;
  const tiers = listActiveTiers(specials, listNet).map((t) => ({
    minQty: t.minQty,
    priceNet: t.priceNet,
    priceGrossFormatted: formatHuf(netToGross(t.priceNet, vat)),
  }));

  const next = findNextTier({
    specials,
    qty: qtySafe,
    currentNet: result.net,
    listNet,
    blockedByOwn: result.source === "own",
  });
  const nextTier =
    next == null
      ? null
      : {
          minQty: next.minQty,
          missingQty: next.missingQty,
          priceNet: next.priceNet,
          priceGrossFormatted: formatHuf(netToGross(next.priceNet, vat)),
          savePct: next.savePct,
          near: next.near,
        };

  const priced = applyPriceBreakdown(
    product,
    listNet,
    result.net,
    vatRate,
    source,
  );
  return {
    ...priced,
    tiers: tiers.length ? tiers : undefined,
    nextTier,
  };
}

/** stockStatus href → megjelenített név */
const stockStatusNameCache = new Map<string, string>();

async function resolveStockStatusName(
  config: ShoprenterConfig,
  status: unknown,
): Promise<string | undefined> {
  if (!status || typeof status !== "object") return undefined;
  const s = status as { href?: string; name?: string };
  if (typeof s.name === "string" && s.name.trim()) return s.name.trim();
  if (!s.href) return undefined;
  if (stockStatusNameCache.has(s.href)) return stockStatusNameCache.get(s.href);
  try {
    const headers = await authHeaders(config);
    const res = await fetch(s.href, { headers, cache: "no-store" });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { name?: string };
    if (typeof data.name === "string" && data.name.trim()) {
      stockStatusNameCache.set(s.href, data.name.trim());
      return data.name.trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Shoprenter: minimalOrderNumber + optional multiply (= pack / carton step). */
export function pickPackRules(item: Record<string, unknown>): {
  minQty: number;
  qtyStep: number;
  maxQty: number | null;
  packLabel?: string;
} {
  const minQty = Math.max(
    1,
    Math.round(toNumber(item.minimalOrderNumber) ?? 1),
  );
  const maxRaw = toNumber(item.maximalOrderNumber) ?? 0;
  const maxQty = maxRaw > 0 ? Math.round(maxRaw) : null;
  const multiply =
    item.minimalOrderNumberMultiply === true ||
    item.minimalOrderNumberMultiply === 1 ||
    item.minimalOrderNumberMultiply === "1";
  const qtyStep = multiply && minQty > 1 ? minQty : 1;
  let packLabel: string | undefined;
  if (qtyStep > 1) packLabel = `×${qtyStep}-osával`;
  else if (minQty > 1) packLabel = `min. ${minQty} db`;
  return { minQty, qtyStep, maxQty, packLabel };
}

/** Snap qty to pack rules (ceil to step, clamp min/max). */
export function normalizePackQuantity(
  qty: number,
  rules: { minQty?: number; qtyStep?: number; maxQty?: number | null },
): number {
  const minQty = Math.max(1, Math.round(rules.minQty ?? 1));
  const step = Math.max(1, Math.round(rules.qtyStep ?? 1));
  const maxQty =
    rules.maxQty != null && rules.maxQty > 0 ? Math.round(rules.maxQty) : null;
  let q = Math.max(minQty, Math.round(Number(qty) || minQty));
  if (step > 1) {
    q = Math.ceil(q / step) * step;
    if (q < minQty) q = Math.ceil(minQty / step) * step;
  }
  if (maxQty != null && q > maxQty) q = maxQty;
  return Math.max(1, q);
}

function pickStockNumbers(item: Record<string, unknown>): {
  stock1: number;
  stock2: number;
  stock3: number;
  stock4: number;
  stockQty: number;
  orderable: boolean;
} {
  const stock1 = toNumber(item.stock1) ?? 0;
  const stock2 = toNumber(item.stock2) ?? 0;
  const stock3 = toNumber(item.stock3) ?? 0;
  const stock4 = toNumber(item.stock4) ?? 0;
  const qtyField = toNumber(item.quantity);
  const sum = stock1 + stock2 + stock3 + stock4;
  // Shoprenter: gyakran stock1…4 a valós raktár; quantity lehet 0 / más jelentésű
  const stockQty = sum > 0 ? sum : qtyField != null && qtyField > 0 ? qtyField : sum;
  const orderableRaw = item.orderable;
  const orderable =
    orderableRaw === true ||
    orderableRaw === 1 ||
    orderableRaw === "1" ||
    String(orderableRaw).toLowerCase() === "true";
  return { stock1, stock2, stock3, stock4, stockQty, orderable };
}

function buildStockPresentation(
  stockQty: number,
  orderable: boolean,
  statusName?: string,
): Pick<
  ResolvedProduct,
  "inStock" | "stockLabel" | "stockTone"
> {
  if (stockQty > 0) {
    const low = stockQty > 0 && stockQty <= 3;
    return {
      inStock: true,
      stockTone: low ? "low" : "ok",
      stockLabel: statusName
        ? `${statusName}: ${stockQty} db`
        : `Készleten: ${stockQty} db`,
    };
  }
  if (orderable) {
    return {
      inStock: false,
      stockTone: "out",
      stockLabel: statusName
        ? `${statusName}, rendelhető`
        : "Nincs raktáron, rendelhető",
    };
  }
  return {
    inStock: false,
    stockTone: "blocked",
    stockLabel: statusName || "Nem rendelhető",
  };
}

async function enrichStock(
  _config: ShoprenterConfig,
  product: ResolvedProduct,
  item: Record<string, unknown>,
): Promise<ResolvedProduct> {
  const nums = pickStockNumbers(item);
  const statusRef =
    nums.stockQty > 0 ? item.inStockStatus : item.noStockStatus;
  const inlineName =
    statusRef && typeof statusRef === "object"
      ? typeof (statusRef as { name?: string }).name === "string"
        ? (statusRef as { name: string }).name.trim()
        : undefined
      : undefined;
  const presentation = buildStockPresentation(
    nums.stockQty,
    nums.orderable,
    inlineName || undefined,
  );
  return {
    ...product,
    stock1: nums.stock1,
    stock2: nums.stock2,
    stock3: nums.stock3,
    stock4: nums.stock4,
    stockQty: nums.stockQty,
    orderable: nums.orderable,
    ...presentation,
  };
}

function pickProductFields(
  item: Record<string, unknown>,
  sku: string,
  shopName: string,
): ResolvedProduct {
  const rawId =
    item.productId ??
    item.product_id ??
    item.innerId ??
    (typeof item.id === "string" || typeof item.id === "number" ? item.id : null);

  let productId: number | null = null;
  let resourceId: string | undefined;

  if (typeof rawId === "number") {
    productId = rawId;
  } else if (typeof rawId === "string") {
    if (/^\d+$/.test(rawId)) {
      productId = Number(rawId);
    } else {
      resourceId = rawId;
      try {
        const decoded = Buffer.from(rawId, "base64").toString("utf8");
        const match = decoded.match(/product_id=(\d+)/i);
        if (match) productId = Number(match[1]);
      } catch {
        /* ignore */
      }
    }
  }

  const modelNumber =
    typeof item.modelNumber === "string" && item.modelNumber
      ? item.modelNumber
      : undefined;

  const gtinRaw =
    (typeof item.gtin === "string" && item.gtin) ||
    (typeof item.ean === "string" && item.ean) ||
    undefined;
  const gtin = gtinRaw?.trim() ? gtinRaw.trim() : undefined;

  const priceNum = toNumber(item.price);
  const costNum =
    toNumber(item.cost) ??
    toNumber(item.costPrice) ??
    toNumber(item.purchasePrice);
  const hasCost = costNum != null && costNum > 0;

  const nameFromFields = pickProductDisplayName(item);

  const stock = pickStockNumbers(item);
  const stockPres = buildStockPresentation(stock.stockQty, stock.orderable);
  const pack = pickPackRules(item);

  const canonicalSku =
    typeof item.sku === "string" && item.sku.trim() ? item.sku.trim() : sku;

  return {
    sku: canonicalSku,
    productId,
    resourceId,
    name: nameFromFields,
    modelNumber,
    gtin,
    price: priceNum,
    priceFormatted: priceNum != null ? formatHuf(priceNum) : undefined,
    costNet: hasCost ? Math.round(costNum!) : undefined,
    costNetFormatted: hasCost ? formatHuf(Math.round(costNum!)) : undefined,
    hasCost,
    imageUrl: buildProductImageUrl(shopName, item.mainPicture),
    productUrl: storefrontProductUrl({ shopName } as ShoprenterConfig, productId),
    stock1: stock.stock1,
    stock2: stock.stock2,
    stock3: stock.stock3,
    stock4: stock.stock4,
    stockQty: stock.stockQty,
    orderable: stock.orderable,
    ...stockPres,
    minQty: pack.minQty,
    qtyStep: pack.qtyStep,
    maxQty: pack.maxQty,
    packLabel: pack.packLabel,
    found: productId != null || Boolean(resourceId),
  };
}

/**
 * Shoprenter termék megjelenő neve — name / imageAlt / productDescriptions.
 * A listaáras `product` resource gyakran üres `name`-et ad; a név a leírásban van.
 */
export function pickProductDisplayName(
  item: Record<string, unknown>,
): string | undefined {
  const top =
    (typeof item.name === "string" && item.name.trim()) ||
    (typeof item.imageAlt === "string" && item.imageAlt.trim()) ||
    "";
  if (top) return top;

  const descs = item.productDescriptions;
  if (!descs || typeof descs !== "object") return undefined;

  const col = descs as {
    items?: unknown;
    name?: unknown;
  };
  if (typeof col.name === "string" && col.name.trim()) return col.name.trim();

  const items = Array.isArray(col.items)
    ? col.items
    : Array.isArray(descs)
      ? descs
      : [];

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    if (typeof d.name === "string" && d.name.trim()) return d.name.trim();
    // nested description object
    const nested = d.productDescription ?? d.description;
    if (nested && typeof nested === "object") {
      const n = nested as Record<string, unknown>;
      if (typeof n.name === "string" && n.name.trim()) return n.name.trim();
    }
  }
  return undefined;
}

/** Shoprenter productDescription resource id (base64). */
export function productDescriptionResourceId(
  productInnerId: number,
  languageId = 1,
): string {
  return Buffer.from(
    `productDescription-product_id=${Math.round(productInnerId)}&language_id=${languageId}`,
    "utf8",
  ).toString("base64");
}

function nameFromDescriptionPayload(
  data: Record<string, unknown>,
): string | undefined {
  if (typeof data.name === "string" && data.name.trim()) {
    return data.name.trim();
  }
  const items = data.items;
  if (Array.isArray(items)) {
    let fallback: string | undefined;
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const d = raw as Record<string, unknown>;
      const n = typeof d.name === "string" ? d.name.trim() : "";
      if (!n) continue;
      const lang = d.language;
      const langInner =
        lang && typeof lang === "object"
          ? (lang as { innerId?: unknown }).innerId
          : undefined;
      if (langInner === 1 || langInner === "1") return n;
      if (!fallback) fallback = n;
    }
    return fallback;
  }
  return undefined;
}

async function fetchJsonRecord(
  config: ShoprenterConfig,
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch(config, path);
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Terméknév Shoprenterből: inline mezők → productDescriptions href →
 * productDescription resource product_id + language_id=1/2.
 */
export async function resolveProductDisplayName(
  config: ShoprenterConfig,
  opts: {
    productInnerId?: number | null;
    productItem?: Record<string, unknown> | null;
  },
): Promise<string | undefined> {
  const item = opts.productItem;
  if (item) {
    const inline = pickProductDisplayName(item);
    if (inline) return inline;

    const descs = item.productDescriptions;
    if (descs && typeof descs === "object" && !Array.isArray(descs)) {
      const href = (descs as { href?: unknown }).href;
      if (typeof href === "string" && href.trim()) {
        try {
          const u = new URL(href);
          let path = u.pathname + u.search;
          // OAuth base already includes /api
          if (getAuthMode(config) === "oauth") {
            path = path.replace(/^\/api(?=\/)/, "");
          }
          if (!path.includes("full=")) {
            path += path.includes("?") ? "&full=1" : "?full=1";
          }
          const data = await fetchJsonRecord(config, path);
          const fromHref = data ? nameFromDescriptionPayload(data) : undefined;
          if (fromHref) return fromHref;
        } catch {
          /* fall through */
        }
      }
    }
  }

  const inner =
    opts.productInnerId != null && Number.isFinite(opts.productInnerId)
      ? Math.round(opts.productInnerId)
      : null;
  if (inner == null || inner < 1) return undefined;

  for (const lang of [1, 2]) {
    const id = productDescriptionResourceId(inner, lang);
    const data = await fetchJsonRecord(
      config,
      `/productDescriptions/${id}?full=1`,
    );
    const name = data ? nameFromDescriptionPayload(data) : undefined;
    if (name) return name;
  }
  return undefined;
}

async function enrichProductName(
  config: ShoprenterConfig,
  product: ResolvedProduct,
  item: Record<string, unknown>,
): Promise<ResolvedProduct> {
  if (product.name && product.name !== product.sku) return product;
  const fromDesc = await resolveProductDisplayName(config, {
    productItem: item,
    productInnerId: product.productId,
  });
  if (fromDesc) return { ...product, name: fromDesc };
  return product;
}

/** Shoprenter classic API: csak ?sku= szűrhető; modelNumber/gtin → index */
type ProductCodeIndex = {
  byModel: Map<string, string>;
  byGtin: Map<string, string>;
  builtAt: number;
  version: number;
  /** true = végigértünk a pageCount-on */
  complete: boolean;
  pageCount: number;
  pagesIndexed: number;
  productCount: number;
};

let productCodeIndex: ProductCodeIndex | null = null;
const CODE_INDEX_TTL_MS = 6 * 60 * 60 * 1000; // 6 óra (lemez + RAM)
/** Biztonsági felső korlát — a stop a Shoprenter pageCount */
const CODE_INDEX_MAX_PAGES = 20_000;
/** v6: full=1 kötelező (full=0 csak href stubot ad, sku/model nélkül) */
const CODE_INDEX_VERSION = 6;
/** Shoprenter limit>200 → kevesebb item / oldal; 200 a praktikus max */
const CODE_INDEX_PAGE_LIMIT = 200;
/** Shoprenter: max 3 req/s → ~350ms szünet az indexelésnél */
const CODE_INDEX_PAGE_DELAY_MS = 350;

function codeIndexCachePath(): string {
  return `${process.cwd()}/.cache/product-code-index-v${CODE_INDEX_VERSION}.json`;
}

function normCode(v: string): string {
  return v.trim().toUpperCase();
}

/** Ugyanarra a gyári/GTIN-re több SKU lehet (szülő vs variáns) */
function preferSku(a: string, b: string): string {
  const score = (s: string) => {
    let sc = 0;
    if (!/^SZULO[_-]/i.test(s)) sc += 20;
    if (!/^PARENT[_-]/i.test(s)) sc += 5;
    if (!/_/.test(s)) sc += 3;
    sc += Math.max(0, 40 - s.length) * 0.1;
    return sc;
  };
  return score(a) >= score(b) ? a : b;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PersistedCodeIndex = {
  version: number;
  builtAt: number;
  complete: boolean;
  pageCount: number;
  pagesIndexed: number;
  productCount: number;
  byModel: Record<string, string>;
  byGtin: Record<string, string>;
};

async function loadPersistedCodeIndex(): Promise<ProductCodeIndex | null> {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(codeIndexCachePath(), "utf8");
    const data = JSON.parse(raw) as PersistedCodeIndex;
    if (data.version !== CODE_INDEX_VERSION) return null;
    if (Date.now() - data.builtAt > CODE_INDEX_TTL_MS) return null;
    const productCount = data.productCount ?? 0;
    // Üres „complete” cache = hibás build (pl. full=0 stubok) — ne használjuk
    if (data.complete && productCount === 0) return null;
    return {
      byModel: new Map(Object.entries(data.byModel || {})),
      byGtin: new Map(Object.entries(data.byGtin || {})),
      builtAt: data.builtAt,
      version: data.version,
      complete: Boolean(data.complete),
      pageCount: data.pageCount ?? 0,
      pagesIndexed: data.pagesIndexed ?? 0,
      productCount,
    };
  } catch {
    return null;
  }
}

async function persistCodeIndex(index: ProductCodeIndex): Promise<void> {
  try {
    const { mkdir, writeFile } = await import("fs/promises");
    const { dirname } = await import("path");
    const file = codeIndexCachePath();
    await mkdir(dirname(file), { recursive: true });
    const payload: PersistedCodeIndex = {
      version: index.version,
      builtAt: index.builtAt,
      complete: index.complete,
      pageCount: index.pageCount,
      pagesIndexed: index.pagesIndexed,
      productCount: index.productCount,
      byModel: Object.fromEntries(index.byModel),
      byGtin: Object.fromEntries(index.byGtin),
    };
    await writeFile(file, JSON.stringify(payload), "utf8");
  } catch {
    /* disk write optional */
  }
}

function ingestProductPage(
  items: Record<string, unknown>[],
  byModel: Map<string, string>,
  byGtin: Map<string, string>,
): number {
  let n = 0;
  for (const item of items) {
    const sku = typeof item.sku === "string" ? item.sku.trim() : "";
    if (!sku) continue;
    n++;
    const model =
      typeof item.modelNumber === "string"
        ? item.modelNumber.trim()
        : typeof item.modelNumber === "number"
          ? String(item.modelNumber)
          : "";
    const gtin =
      (typeof item.gtin === "string" && item.gtin.trim()) ||
      (typeof item.ean === "string" && item.ean.trim()) ||
      (typeof item.gtin === "number" ? String(item.gtin) : "") ||
      "";
    if (model) {
      const k = normCode(model);
      const prev = byModel.get(k);
      byModel.set(k, prev ? preferSku(prev, sku) : sku);
    }
    if (gtin) {
      const k = normCode(gtin);
      const prev = byGtin.get(k);
      byGtin.set(k, prev ? preferSku(prev, sku) : sku);
    }
  }
  return n;
}

async function ensureProductCodeIndex(
  config: ShoprenterConfig,
): Promise<ProductCodeIndex> {
  if (
    productCodeIndex &&
    productCodeIndex.version === CODE_INDEX_VERSION &&
    productCodeIndex.complete &&
    Date.now() - productCodeIndex.builtAt < CODE_INDEX_TTL_MS
  ) {
    return productCodeIndex;
  }

  const fromDisk = await loadPersistedCodeIndex();
  if (fromDisk?.complete) {
    productCodeIndex = fromDisk;
    return fromDisk;
  }

  const byModel = new Map<string, string>(fromDisk?.byModel);
  const byGtin = new Map<string, string>(fromDisk?.byGtin);
  let productCount = fromDisk?.productCount ?? 0;
  let pageCount = Math.max(1, fromDisk?.pageCount ?? 1);
  let startPage = fromDisk && !fromDisk.complete ? fromDisk.pagesIndexed : 0;

  // full=1 kell: full=0 csak {href} stubokat ad vissza (sku/model/gtin nélkül)
  for (let page = startPage; page < CODE_INDEX_MAX_PAGES; page++) {
    const res = await apiFetch(
      config,
      `/products?page=${page}&limit=${CODE_INDEX_PAGE_LIMIT}&full=1`,
    );
    if (res.status === 429) {
      await sleep(1000);
      page--;
      continue;
    }
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
      pageCount?: number;
    };
    if (typeof data.pageCount === "number" && data.pageCount > 0) {
      pageCount = data.pageCount;
    }
    const items = data.items ?? [];
    if (!items.length) {
      pageCount = page;
      startPage = page;
      break;
    }
    const ingested = ingestProductPage(items, byModel, byGtin);
    if (ingested === 0) {
      // Stub lista (nincs sku) — ne jelöljük complete-nek
      break;
    }
    productCount += ingested;
    startPage = page + 1;

    // Folyamatos lemezmentés: hosszú katalógus (pl. 2500 oldal) megszakítás után folytatható
    productCodeIndex = {
      byModel,
      byGtin,
      builtAt: Date.now(),
      version: CODE_INDEX_VERSION,
      complete: startPage >= pageCount,
      pageCount,
      pagesIndexed: startPage,
      productCount,
    };
    if (page % 5 === 0 || startPage >= pageCount) {
      await persistCodeIndex(productCodeIndex);
    }

    if (startPage >= pageCount) break;
    await sleep(CODE_INDEX_PAGE_DELAY_MS);
  }

  const complete = startPage >= pageCount && productCount > 0;
  productCodeIndex = {
    byModel,
    byGtin,
    builtAt: Date.now(),
    version: CODE_INDEX_VERSION,
    complete,
    pageCount,
    pagesIndexed: startPage,
    productCount,
  };
  await persistCodeIndex(productCodeIndex);
  return productCodeIndex;
}

async function lookupSkuByModelOrGtin(
  config: ShoprenterConfig,
  code: string,
): Promise<string | null> {
  const key = normCode(code);
  const index = await ensureProductCodeIndex(config);
  return index.byModel.get(key) ?? index.byGtin.get(key) ?? null;
}

/** Autocomplete: only use index if already warm (no slow rebuild on keystroke). */
async function getWarmProductCodeIndex(): Promise<ProductCodeIndex | null> {
  if (
    productCodeIndex &&
    productCodeIndex.version === CODE_INDEX_VERSION &&
    Date.now() - productCodeIndex.builtAt < CODE_INDEX_TTL_MS
  ) {
    return productCodeIndex;
  }
  const fromDisk = await loadPersistedCodeIndex();
  if (fromDisk) {
    productCodeIndex = fromDisk;
    return fromDisk;
  }
  return null;
}

export type ProductSearchHit = {
  sku: string;
  productId: number | null;
  name?: string;
  modelNumber?: string;
  gtin?: string;
  priceNetFormatted?: string;
  priceGrossFormatted?: string;
  stockTone?: ResolvedProduct["stockTone"];
  inStock?: boolean;
  orderable?: boolean;
  packLabel?: string;
  minQty?: number;
  qtyStep?: number;
};

/**
 * Typeahead search: Shoprenter ?search= + optional warm code-index prefix hits.
 */
export async function searchProducts(
  config: ShoprenterConfig,
  query: string,
  limit = 8,
): Promise<ProductSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cap = Math.min(12, Math.max(1, Math.round(limit) || 8));
  const encoded = encodeURIComponent(q);
  const seen = new Set<string>();
  const out: ProductSearchHit[] = [];

  const pushResolved = async (item: Record<string, unknown>) => {
    if (out.length >= cap) return;
    const sku = typeof item.sku === "string" ? item.sku.trim() : "";
    if (!sku) return;
    const key = normCode(sku);
    if (seen.has(key)) return;
    seen.add(key);
    try {
      let p = pickProductFields(item, sku, config.shopName);
      p = await enrichPricing(config, p, item);
      p = await enrichStock(config, p, item);
      p = await enrichProductName(config, p, item);
      if (!p.found) return;
      out.push({
        sku: p.sku,
        productId: p.productId,
        name: p.name,
        modelNumber: p.modelNumber,
        gtin: p.gtin,
        priceNetFormatted: p.priceNetFormatted,
        priceGrossFormatted: p.priceGrossFormatted,
        stockTone: p.stockTone,
        inStock: p.inStock,
        orderable: p.orderable,
        packLabel: p.packLabel,
        minQty: p.minQty,
        qtyStep: p.qtyStep,
      });
    } catch {
      /* skip bad row */
    }
  };

  const paths = [
    `/products?search=${encoded}&full=1&limit=${cap}`,
    `/products?sku=${encoded}&full=1&limit=${cap}`,
  ];
  for (const path of paths) {
    if (out.length >= cap) break;
    try {
      const res = await apiFetch(config, path);
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data.sku === "string") {
        await pushResolved(data);
        continue;
      }
      const items = (data.items as Record<string, unknown>[]) ?? [];
      for (const item of items) {
        await pushResolved(item);
        if (out.length >= cap) break;
      }
    } catch {
      /* try next */
    }
  }

  if (out.length < cap) {
    const index = await getWarmProductCodeIndex();
    if (index) {
      const needle = normCode(q);
      const skus: string[] = [];
      const consider = (map: Map<string, string>) => {
        for (const [code, sku] of map) {
          if (code.startsWith(needle) || normCode(sku).startsWith(needle)) {
            if (!seen.has(normCode(sku))) skus.push(sku);
          }
          if (skus.length >= cap * 2) break;
        }
      };
      consider(index.byModel);
      if (skus.length < cap * 2) consider(index.byGtin);
      for (const sku of skus) {
        if (out.length >= cap) break;
        if (seen.has(normCode(sku))) continue;
        try {
          const p = await resolveProductByExactSku(config, sku);
          if (!p.found) continue;
          seen.add(normCode(p.sku));
          out.push({
            sku: p.sku,
            productId: p.productId,
            name: p.name,
            modelNumber: p.modelNumber,
            gtin: p.gtin,
            priceNetFormatted: p.priceNetFormatted,
            priceGrossFormatted: p.priceGrossFormatted,
            stockTone: p.stockTone,
            inStock: p.inStock,
            orderable: p.orderable,
            packLabel: p.packLabel,
            minQty: p.minQty,
            qtyStep: p.qtyStep,
          });
        } catch {
          /* skip */
        }
      }
    }
  }

  return out;
}

export async function resolveProductByExactSku(
  config: ShoprenterConfig,
  lookupSku: string,
  customerGroupInnerId?: number | null,
  qty = 1,
): Promise<ResolvedProduct> {
  const trimmed = lookupSku.trim();
  const encoded = encodeURIComponent(trimmed);
  const codeKey = normCode(trimmed);
  const qtySafe = Math.max(1, Math.round(Number(qty) || 1));

  const matchesCode = (node: Record<string, unknown>): boolean => {
    const candidates = [node.sku];
    return candidates.some(
      (v) => typeof v === "string" && normCode(v) === codeKey,
    );
  };

  const candidates = [
    `/products?sku=${encoded}&full=1`,
    `/productExtend?sku=${encoded}&full=1`,
  ];

  let lastError = "not found";

  for (const path of candidates) {
    const res = await apiFetch(config, path);
    if (res.status === 404) continue;
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      if (res.status === 400 && /not available/i.test(body)) continue;
      lastError = `HTTP ${res.status} on ${path}: ${body}`;
      continue;
    }

    const data = (await res.json()) as Record<string, unknown>;

    if (matchesCode(data) || data.sku === trimmed) {
      const picked = pickProductFields(data, trimmed, config.shopName);
      const priced = await enrichPricing(
        config,
        picked,
        data,
        customerGroupInnerId,
        qtySafe,
      );
      const stocked = await enrichStock(config, priced, data);
      return enrichProductName(config, stocked, data);
    }

    const items =
      (data.items as unknown[]) ??
      (data.productExtend as unknown[]) ??
      (Array.isArray(data) ? data : null);

    if (Array.isArray(items) && items.length > 0) {
      const exact =
        (items as Record<string, unknown>[]).find((it) => {
          const node =
            (it.product as Record<string, unknown> | undefined) ?? it;
          return matchesCode(node);
        }) ?? null;

      if (!exact) {
        lastError = items.length > 1 ? "ambiguous" : "not found";
        continue;
      }

      const node =
        (exact.product as Record<string, unknown> | undefined) ?? exact;

      const merged = {
        ...node,
        sku: (node.sku as string) ?? trimmed,
        name:
          (exact.name as string) ??
          (node.name as string) ??
          (node.imageAlt as string) ??
          undefined,
      };
      const picked = pickProductFields(merged, trimmed, config.shopName);
      const priced = await enrichPricing(
        config,
        picked,
        merged,
        customerGroupInnerId,
        qtySafe,
      );
      const stocked = await enrichStock(config, priced, merged);
      return enrichProductName(config, stocked, merged);
    }

    lastError = "not found";
  }

  return {
    sku: trimmed,
    productId: null,
    found: false,
    error: lastError,
  };
}

export async function resolveProductBySku(
  config: ShoprenterConfig,
  sku: string,
  customerGroupInnerId?: number | null,
  qty = 1,
): Promise<ResolvedProduct> {
  const trimmed = sku.trim();
  if (!trimmed) {
    return { sku, productId: null, found: false, error: "empty sku" };
  }

  // 1) közvetlen cikkszám
  const direct = await resolveProductByExactSku(
    config,
    trimmed,
    customerGroupInnerId,
    qty,
  );
  if (direct.found) return direct;

  // 2) gyári cikkszám / vonalkód (GTIN) → index → canonical sku
  const alt = await lookupSkuByModelOrGtin(config, trimmed);
  if (alt && normCode(alt) !== normCode(trimmed)) {
    const viaAlt = await resolveProductByExactSku(
      config,
      alt,
      customerGroupInnerId,
      qty,
    );
    if (viaAlt.found) return viaAlt;
  }

  return {
    sku: trimmed,
    productId: null,
    found: false,
    error: direct.error || "not found",
  };
}

export async function resolveProductsBySkus(
  config: ShoprenterConfig,
  skus: string[],
  customerGroupInnerId?: number | null,
  quantities?: number[],
): Promise<ResolvedProduct[]> {
  const cache = new Map<string, ResolvedProduct>();

  const results: ResolvedProduct[] = [];
  for (let i = 0; i < skus.length; i++) {
    const code = skus[i].trim();
    const qty = Math.max(1, Math.round(Number(quantities?.[i]) || 1));
    if (!code) {
      results.push({
        sku: skus[i],
        productId: null,
        found: false,
        error: "empty sku",
      });
      continue;
    }
    const key = `${normCode(code)}:${qty}`;
    let hit = cache.get(key);
    if (!hit) {
      try {
        hit = await resolveProductBySku(
          config,
          code,
          customerGroupInnerId,
          qty,
        );
      } catch (e) {
        hit = {
          sku: code,
          productId: null,
          found: false,
          error: e instanceof Error ? e.message : "resolve failed",
        };
      }
      cache.set(key, hit);
    }
    results.push(hit);
  }
  return results;
}

/* ─── Customer orders (B2B „Rendeléseim”) ─── */

export type CustomerOrderLine = {
  sku: string;
  modelNumber?: string;
  gtin?: string;
  name?: string;
  quantity: number;
  priceNet?: number;
  priceGross?: number;
  lineTotalNet?: number;
  lineTotalGross?: number;
  vatAmount?: number;
  productId?: number | null;
  /** Storefront product page URL when productId known */
  productUrl?: string;
};

export type CustomerOrderSummary = {
  id: string;
  innerId: string;
  dateCreated: string;
  dateLabel: string;
  /** Preferált megjelenített összeg (bruttó ha van, különben nettó) */
  total: number;
  totalFormatted: string;
  totalNet?: number;
  totalGross?: number;
  shippingGross?: number;
  shippingNet?: number;
  paymentGross?: number;
  /** Kedvezmény összege abszolút értékben (pozitív = kapott kedvezmény) */
  discountGross?: number;
  tax?: number;
  couponCode?: string | null;
  status: string;
  /** Shoprenter orderStatus resource id (or href key) when available */
  statusId?: string | null;
  statusColor?: string;
  itemCount: number;
  email?: string | null;
  customerInnerId?: number | null;
  customerName?: string | null;
  /** Present when list `full=1` already embeds orderProducts. */
  lines?: CustomerOrderLine[];
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  lines: CustomerOrderLine[];
  paymentMethodName?: string;
  shippingMethodName?: string;
};

type StatusMeta = { name: string; color?: string; id?: string };
let orderStatusCache: Map<string, StatusMeta> | null = null;

export type ShopOrderStatus = {
  id: string;
  name: string;
  color?: string;
  /** True if name looks like cancelled / refunded (UI hint). */
  looksCancelled: boolean;
};

/** Extract stable status key from an order's orderStatus field. */
export function extractOrderStatusId(orderStatus: unknown): string | null {
  if (!orderStatus || typeof orderStatus !== "object") return null;
  const os = orderStatus as { href?: string; id?: string };
  if (typeof os.id === "string" && os.id.trim()) return os.id.trim();
  if (typeof os.href === "string" && os.href.trim()) {
    const href = os.href.trim();
    const m = href.match(/orderStatuses\/([^/?#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
    return href;
  }
  return null;
}

export function orderStatusNameLooksCancelled(name: string): boolean {
  const s = (name || "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("storn") ||
    s.includes("cancel") ||
    s.includes("töröl") ||
    s.includes("torol") ||
    s.includes("refund") ||
    s.includes("visszatér")
  );
}

function formatOrderDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(t));
  } catch {
    return iso.slice(0, 10);
  }
}

function orderQty(row: Record<string, unknown>): number {
  const sum =
    (toNumber(row.stock1) ?? 0) +
    (toNumber(row.stock2) ?? 0) +
    (toNumber(row.stock3) ?? 0) +
    (toNumber(row.stock4) ?? 0);
  return Math.max(1, Math.round(sum) || 1);
}

function productIdFromOrderLine(row: Record<string, unknown>): number | null {
  const inner = toNumber(row.productInnerId);
  if (inner != null) return Math.round(inner);
  const product = row.product as { href?: string } | undefined;
  const href = product?.href || "";
  const m = href.match(/product_id=(\d+)/i) || href.match(/PTYy\w+/);
  // base64 payload often product-product_id=NNN
  try {
    const idPart = href.split("/").pop() || "";
    const decoded = Buffer.from(idPart, "base64").toString("utf8");
    const m2 = decoded.match(/product_id=(\d+)/i);
    if (m2) return Number(m2[1]);
  } catch {
    /* ignore */
  }
  if (m && m[1]) return Number(m[1]);
  return null;
}

function modelFromUnknown(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function mapOrderLine(row: Record<string, unknown>): CustomerOrderLine | null {
  const sku =
    (typeof row.sku === "string" && row.sku.trim()) ||
    (typeof row.sku === "number" && Number.isFinite(row.sku)
      ? String(row.sku)
      : "") ||
    "";
  const modelNumber = modelFromUnknown(row.modelNumber);
  const gtinRaw =
    (typeof row.gtin === "string" && row.gtin.trim()) ||
    (typeof row.gtin === "number" ? String(row.gtin) : "") ||
    "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const productId = productIdFromOrderLine(row);
  // Keep lines even without SKU if any other identity exists (export / history).
  if (!sku && !modelNumber && !gtinRaw && !name && productId == null) {
    return null;
  }

  const quantity = orderQty(row);
  const priceNet = toNumber(row.price);
  const priceGross =
    toNumber(row.grossPrice) ?? toNumber(row.grossPriceCurrency);
  let lineTotalNet = toNumber(row.total);
  if (lineTotalNet == null && priceNet != null) {
    lineTotalNet = Math.round(priceNet * quantity * 100) / 100;
  }
  let lineTotalGross = toNumber(row.grossTotal) ?? toNumber(row.totalGross);
  if (lineTotalGross == null && priceGross != null) {
    lineTotalGross = Math.round(priceGross * quantity * 100) / 100;
  }
  let vatAmount: number | undefined;
  if (lineTotalGross != null && lineTotalNet != null) {
    vatAmount = Math.round((lineTotalGross - lineTotalNet) * 100) / 100;
  } else if (priceGross != null && priceNet != null) {
    vatAmount =
      Math.round((priceGross - priceNet) * quantity * 100) / 100;
  }

  return {
    sku,
    modelNumber,
    gtin: gtinRaw || undefined,
    name: name || undefined,
    quantity,
    priceNet: priceNet ?? undefined,
    priceGross: priceGross ?? undefined,
    lineTotalNet: lineTotalNet ?? undefined,
    lineTotalGross: lineTotalGross ?? undefined,
    vatAmount,
    productId,
  };
}

async function ensureOrderStatusCache(
  config: ShoprenterConfig,
): Promise<Map<string, StatusMeta>> {
  if (orderStatusCache && orderStatusCache.size) return orderStatusCache;
  const map = new Map<string, StatusMeta>();
  try {
    for (let page = 0; page < 20; page++) {
      const res = await apiFetch(
        config,
        `/orderStatusDescriptions?page=${page}&limit=100&full=1`,
      );
      if (!res.ok) break;
      const data = (await res.json()) as {
        items?: {
          name?: string;
          color?: string;
          orderStatus?: { href?: string; id?: string };
        }[];
        pageCount?: number;
      };
      const items = data.items ?? [];
      if (!items.length) break;
      for (const it of items) {
        const name = typeof it.name === "string" ? it.name.trim() : "";
        if (!name) continue;
        const href = it.orderStatus?.href;
        const idRaw = it.orderStatus?.id;
        const id =
          typeof idRaw === "string" && idRaw.trim()
            ? idRaw.trim()
            : href
              ? extractOrderStatusId({ href })
              : null;
        const meta: StatusMeta = {
          name,
          color: typeof it.color === "string" ? it.color : undefined,
          id: id || undefined,
        };
        if (href) map.set(href, meta);
        if (id) map.set(id, meta);
      }
      if (page + 1 >= (data.pageCount ?? page + 1)) break;
      await sleep(350);
    }
  } catch {
    /* optional enrichment */
  }
  orderStatusCache = map;
  return map;
}

/**
 * Unique order statuses for the shop (merchant UI: which count toward level-up).
 */
export async function listOrderStatuses(
  config: ShoprenterConfig,
): Promise<ShopOrderStatus[]> {
  const cache = await ensureOrderStatusCache(config);
  const byId = new Map<string, ShopOrderStatus>();
  for (const meta of cache.values()) {
    const id = meta.id;
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: meta.name,
      color: meta.color,
      looksCancelled: orderStatusNameLooksCancelled(meta.name),
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "hu"),
  );
}

async function statusForOrder(
  config: ShoprenterConfig,
  orderStatus: unknown,
): Promise<StatusMeta> {
  const cache = await ensureOrderStatusCache(config);
  const statusId = extractOrderStatusId(orderStatus);
  if (orderStatus && typeof orderStatus === "object") {
    const os = orderStatus as { href?: string; id?: string; name?: string };
    if (typeof os.name === "string" && os.name.trim()) {
      return { name: os.name.trim(), id: statusId || undefined };
    }
    if (os.href && cache.has(os.href)) {
      const hit = cache.get(os.href)!;
      return { ...hit, id: hit.id || statusId || undefined };
    }
    if (os.id && cache.has(os.id)) {
      const hit = cache.get(os.id)!;
      return { ...hit, id: hit.id || statusId || undefined };
    }
  }
  return { name: "—", id: statusId || undefined };
}

function extractOrderProducts(
  raw: unknown,
): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((x) => x && typeof x === "object") as Record<
      string,
      unknown
    >[];
  }
  return [];
}

function customerInnerFromOrderRow(row: Record<string, unknown>): number | null {
  const direct =
    toNumber(row.customerInnerId) ??
    toNumber(row.userId) ??
    toNumber(row.customer_id);
  if (direct != null) return Math.round(direct);

  const customer = row.customer as
    | { href?: string; id?: string; innerId?: unknown }
    | undefined;
  if (customer) {
    const fromInner = toNumber(customer.innerId);
    if (fromInner != null) return Math.round(fromInner);
    const href = typeof customer.href === "string" ? customer.href : "";
    const m = href.match(/customer_id=(\d+)/i);
    if (m) return Number(m[1]);
    try {
      const idPart = (typeof customer.id === "string" ? customer.id : "")
        .split("/")
        .pop();
      if (idPart) {
        const decoded = Buffer.from(idPart, "base64").toString("utf8");
        const m2 = decoded.match(/customer_id=(\d+)/i);
        if (m2) return Number(m2[1]);
      }
    } catch {
      /* ignore */
    }
    if (href) {
      try {
        const idPart = href.split("/").pop() || "";
        const decoded = Buffer.from(idPart, "base64").toString("utf8");
        const m3 = decoded.match(/customer_id=(\d+)/i);
        if (m3) return Number(m3[1]);
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function customerNameFromOrderRow(row: Record<string, unknown>): string | null {
  const first =
    typeof row.firstname === "string"
      ? row.firstname.trim()
      : typeof row.firstName === "string"
        ? row.firstName.trim()
        : "";
  const last =
    typeof row.lastname === "string"
      ? row.lastname.trim()
      : typeof row.lastName === "string"
        ? row.lastName.trim()
        : "";
  const company =
    typeof row.company === "string"
      ? row.company.trim()
      : typeof row.shippingCompany === "string"
        ? row.shippingCompany.trim()
        : "";
  if (company) return company;
  const name = [last, first].filter(Boolean).join(" ").trim();
  return name || null;
}

async function mapOrderSummary(
  config: ShoprenterConfig,
  row: Record<string, unknown>,
): Promise<CustomerOrderSummary | null> {
  const id = typeof row.id === "string" ? row.id : "";
  const innerId =
    row.innerId != null ? String(row.innerId) : id ? id.slice(0, 8) : "";
  if (!id && !innerId) return null;
  const dateCreated =
    typeof row.dateCreated === "string" ? row.dateCreated : "";
  const totalNet = toNumber(row.total) ?? undefined;
  const totalGross =
    toNumber(row.totalGross) ?? toNumber(row.grossTotal) ?? undefined;
  const displayTotal = Math.round(totalGross ?? totalNet ?? 0);
  const shippingGross =
    toNumber(row.shippingGrossPrice) ?? toNumber(row.shippingGross) ?? undefined;
  const shippingNet =
    toNumber(row.shippingNetPrice) ?? toNumber(row.shippingNet) ?? undefined;
  const paymentGross =
    toNumber(row.paymentGrossPrice) ?? toNumber(row.paymentGross) ?? undefined;
  const couponRaw =
    toNumber(row.couponGrossPrice) ?? toNumber(row.couponGross) ?? null;
  const cartDisc =
    toNumber(row.cartAmountDiscount) ?? toNumber(row.cartDiscount) ?? null;
  let discountGross: number | undefined;
  const discParts: number[] = [];
  if (couponRaw != null && couponRaw !== 0) discParts.push(Math.abs(couponRaw));
  if (cartDisc != null && cartDisc !== 0) discParts.push(Math.abs(cartDisc));
  if (discParts.length) {
    discountGross = Math.round(discParts.reduce((a, b) => a + b, 0));
  }
  const tax = toNumber(row.taxPrice) ?? toNumber(row.tax) ?? undefined;
  const couponCode =
    typeof row.couponCode === "string" && row.couponCode.trim()
      ? row.couponCode.trim()
      : null;
  const products = extractOrderProducts(row.orderProducts);
  const status = await statusForOrder(config, row.orderStatus);
  const statusId =
    status.id || extractOrderStatusId(row.orderStatus) || null;
  const email =
    typeof row.email === "string" && row.email.trim()
      ? row.email.trim().toLowerCase()
      : null;
  const lines = products
    .map((p) => mapOrderLine(p))
    .filter((x): x is CustomerOrderLine => Boolean(x));

  return {
    id: id || innerId,
    innerId,
    dateCreated,
    dateLabel: dateCreated ? formatOrderDate(dateCreated) : "—",
    total: displayTotal,
    totalFormatted: formatHuf(displayTotal),
    totalNet: totalNet != null ? Math.round(totalNet) : undefined,
    totalGross: totalGross != null ? Math.round(totalGross) : undefined,
    shippingGross:
      shippingGross != null ? Math.round(shippingGross) : undefined,
    shippingNet: shippingNet != null ? Math.round(shippingNet) : undefined,
    paymentGross: paymentGross != null ? Math.round(paymentGross) : undefined,
    discountGross,
    tax: tax != null ? Math.round(tax) : undefined,
    couponCode,
    status: status.name,
    statusId,
    statusColor: status.color,
    itemCount: products.length || lines.length,
    email,
    customerInnerId: customerInnerFromOrderRow(row),
    customerName: customerNameFromOrderRow(row),
    lines: lines.length ? lines : undefined,
  };
}

export async function getCustomerEmailByUserId(
  config: ShoprenterConfig,
  userId: number | string,
): Promise<string> {
  const id = String(userId).trim();
  if (!id || id === "0") {
    throw new Error("Bejelentkezés szükséges");
  }
  const res = await apiFetch(
    config,
    `/customers?innerId=${encodeURIComponent(id)}&full=1&limit=1`,
  );
  if (!res.ok) {
    throw new Error(`Customer lookup failed (${res.status})`);
  }
  const data = (await res.json()) as {
    items?: { email?: string; innerId?: string | number }[];
  };
  const email = data.items?.[0]?.email?.trim();
  if (!email || !email.includes("@")) {
    throw new Error("A vevő email címe nem elérhető");
  }
  return email;
}

export async function listCustomerOrders(
  config: ShoprenterConfig,
  userId: number | string,
  opts?: { limit?: number; page?: number; email?: string | null },
): Promise<{ orders: CustomerOrderSummary[]; pageCount: number }> {
  const known = typeof opts?.email === "string" ? opts.email.trim() : "";
  const email =
    known.includes("@")
      ? known
      : await getCustomerEmailByUserId(config, userId);
  const limit = Math.min(50, Math.max(1, opts?.limit ?? 30));
  const page = Math.max(0, opts?.page ?? 0);
  const qs = new URLSearchParams({
    email,
    excludeAbandonedCart: "1",
    excludeStorno: "1",
    full: "1",
    limit: String(limit),
    page: String(page),
  });
  const res = await apiFetch(config, `/orderExtend?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Orders list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    items?: Record<string, unknown>[];
    pageCount?: number;
  };
  // Warm status cache once (not per row) — stays under 3 rps budget.
  await ensureOrderStatusCache(config).catch(() => null);
  const orders: CustomerOrderSummary[] = [];
  for (const row of data.items ?? []) {
    const mapped = await mapOrderSummary(config, row);
    if (mapped) orders.push(mapped);
  }
  // newest first (API usually is, but sort defensively)
  orders.sort(
    (a, b) =>
      parseShoprenterOrderTime(b.dateCreated) -
      parseShoprenterOrderTime(a.dateCreated),
  );
  return { orders, pageCount: data.pageCount ?? 1 };
}

/**
 * Shoprenter order timestamps are often "YYYY-MM-DD HH:mm:ss" — raw Date.parse is NaN.
 */
export function parseShoprenterOrderTime(
  raw: string | null | undefined,
): number {
  if (!raw || !raw.trim()) return 0;
  const s = raw.trim();
  const iso = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  if (Number.isFinite(iso)) return iso;
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!m) return 0;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] || 0),
    Number(m[5] || 0),
    Number(m[6] || 0),
  ).getTime();
}

type OrderExtendPage = {
  items: CustomerOrderSummary[];
  pageCount: number;
  newestMs: number;
  oldestMs: number;
};

/**
 * Bolt összes rendelése (merchant riport / sync) — lapozva, rate-limit barát.
 * Mindig a legújabb felől tölt (detektálja, ha az API ascending), amíg
 * dateFromMs el nincs érve vagy maxPages.
 */
export async function listShopOrders(
  config: ShoprenterConfig,
  opts?: {
    dateFromMs?: number;
    dateToMs?: number;
    maxPages?: number;
    limit?: number;
  },
): Promise<CustomerOrderSummary[]> {
  const limit = Math.min(50, Math.max(10, opts?.limit ?? 50));
  const maxPages = Math.min(24, Math.max(1, opts?.maxPages ?? 8));
  const dateFrom = opts?.dateFromMs ?? 0;
  const dateTo = opts?.dateToMs ?? 0;

  async function fetchPage(page: number): Promise<OrderExtendPage> {
    const qs = new URLSearchParams({
      excludeAbandonedCart: "1",
      excludeStorno: "1",
      full: "1",
      limit: String(limit),
      page: String(page),
    });
    // Note: OrderExtend has no dateFrom/dateTo query params (40010 if sent).
    // Date window is applied client-side after newest-first pagination.

    const res = await apiFetch(config, `/orderExtend?${qs.toString()}`);
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          "A Shoprenter most túl sok kérést kapott (429). Várj, majd próbáld újra.",
        );
      }
      const text = await res.text();
      throw new Error(
        `Bolti rendelések sikertelen (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as {
      items?: Record<string, unknown>[];
      pageCount?: number;
    };
    const mapped: CustomerOrderSummary[] = [];
    let newestMs = 0;
    let oldestMs = Number.POSITIVE_INFINITY;
    for (const row of data.items ?? []) {
      const m = await mapOrderSummary(config, row);
      if (!m) continue;
      const t = parseShoprenterOrderTime(m.dateCreated);
      if (t) {
        if (t > newestMs) newestMs = t;
        if (t < oldestMs) oldestMs = t;
      }
      mapped.push(m);
    }
    if (!Number.isFinite(oldestMs)) oldestMs = 0;
    return {
      items: mapped,
      pageCount: Math.max(1, data.pageCount ?? page + 1),
      newestMs,
      oldestMs,
    };
  }

  const cache = new Map<number, OrderExtendPage>();
  async function getPage(page: number): Promise<OrderExtendPage> {
    const hit = cache.get(page);
    if (hit) return hit;
    if (cache.size > 0) await sleep(180);
    const data = await fetchPage(page);
    cache.set(page, data);
    return data;
  }

  const first = await getPage(0);
  const pageCount = first.pageCount;

  let newestFirst = true;
  if (pageCount > 1) {
    const last = await getPage(pageCount - 1);
    if (first.newestMs && last.newestMs) {
      newestFirst = first.newestMs >= last.newestMs;
    } else if (first.oldestMs && last.oldestMs) {
      newestFirst = first.oldestMs >= last.oldestMs;
    }
  }

  const byId = new Map<string, CustomerOrderSummary>();
  const absorb = (items: CustomerOrderSummary[]) => {
    for (const o of items) {
      const t = parseShoprenterOrderTime(o.dateCreated);
      if (!t) continue;
      if (dateFrom && t < dateFrom) continue;
      if (dateTo && t > dateTo) continue;
      byId.set(o.id, o);
    }
  };

  for (let i = 0; i < Math.min(maxPages, pageCount); i++) {
    const page = newestFirst ? i : pageCount - 1 - i;
    const data = await getPage(page);
    absorb(data.items);

    // Walking toward older: stop once the whole page is before dateFrom.
    if (dateFrom && data.oldestMs > 0 && data.oldestMs < dateFrom) {
      break;
    }
    if (!data.items.length) break;
  }

  const out = [...byId.values()];
  out.sort(
    (a, b) =>
      parseShoprenterOrderTime(b.dateCreated) -
      parseShoprenterOrderTime(a.dateCreated),
  );
  return out;
}

/** Rendelés tételei — merchant riport (email ownership nélkül). */
export async function getOrderDetailById(
  config: ShoprenterConfig,
  orderId: string,
): Promise<CustomerOrderDetail> {
  const id = orderId.trim();
  if (!id) throw new Error("Order id required");

  const res = await apiFetch(
    config,
    `/orderExtend/${encodeURIComponent(id)}?full=1`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Order detail failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const row = (await res.json()) as Record<string, unknown>;

  let products = extractOrderProducts(row.orderProducts);
  if (!products.length) {
    const href =
      row.orderProducts &&
      typeof row.orderProducts === "object" &&
      typeof (row.orderProducts as { href?: string }).href === "string"
        ? (row.orderProducts as { href: string }).href
        : "";
    if (href) {
      const headers = await authHeaders(config);
      const sep = href.includes("?") ? "&" : "?";
      const pr = await fetch(`${href}${sep}full=1&limit=200`, {
        headers,
        cache: "no-store",
      });
      if (pr.ok) {
        const pj = (await pr.json()) as { items?: Record<string, unknown>[] };
        products = pj.items ?? [];
      }
    }
  }

  const summary = await mapOrderSummary(config, {
    ...row,
    orderProducts: products,
  });
  if (!summary) throw new Error("Invalid order payload");

  const lines = products
    .map((p) => mapOrderLine(p))
    .filter((x): x is CustomerOrderLine => Boolean(x))
    .map((line) => ({
      ...line,
      productUrl: storefrontProductUrl(config, line.productId),
    }));

  return {
    ...summary,
    lines,
    paymentMethodName:
      typeof row.paymentMethodName === "string"
        ? row.paymentMethodName
        : undefined,
    shippingMethodName:
      typeof row.shippingMethodLocalizedName === "string"
        ? row.shippingMethodLocalizedName
        : typeof row.shippingMethodName === "string"
          ? row.shippingMethodName
          : undefined,
  };
}

export async function getCustomerOrderDetail(
  config: ShoprenterConfig,
  orderId: string,
  userId: number | string,
): Promise<CustomerOrderDetail> {
  const email = await getCustomerEmailByUserId(config, userId);
  const id = orderId.trim();
  if (!id) throw new Error("Order id required");

  const res = await apiFetch(
    config,
    `/orderExtend/${encodeURIComponent(id)}?full=1`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Order detail failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const row = (await res.json()) as Record<string, unknown>;
  const orderEmail =
    typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  if (!orderEmail || orderEmail !== email.trim().toLowerCase()) {
    throw new Error("Order does not belong to this customer");
  }

  let products = extractOrderProducts(row.orderProducts);
  if (!products.length) {
    const href =
      row.orderProducts &&
      typeof row.orderProducts === "object" &&
      typeof (row.orderProducts as { href?: string }).href === "string"
        ? (row.orderProducts as { href: string }).href
        : "";
    if (href) {
      const headers = await authHeaders(config);
      const sep = href.includes("?") ? "&" : "?";
      const pr = await fetch(`${href}${sep}full=1&limit=200`, {
        headers,
        cache: "no-store",
      });
      if (pr.ok) {
        const pj = (await pr.json()) as { items?: Record<string, unknown>[] };
        products = pj.items ?? [];
      }
    }
  }

  const summary = await mapOrderSummary(config, {
    ...row,
    orderProducts: products,
  });
  if (!summary) throw new Error("Invalid order payload");

  const lines = products
    .map((p) => mapOrderLine(p))
    .filter((x): x is CustomerOrderLine => Boolean(x))
    .map((line) => ({
      ...line,
      productUrl: storefrontProductUrl(config, line.productId),
    }));

  return {
    ...summary,
    lines,
    paymentMethodName:
      typeof row.paymentMethodName === "string"
        ? row.paymentMethodName
        : undefined,
    shippingMethodName:
      typeof row.shippingMethodLocalizedName === "string"
        ? row.shippingMethodLocalizedName
        : typeof row.shippingMethodName === "string"
          ? row.shippingMethodName
          : undefined,
  };
}

export async function pingAuth(config: ShoprenterConfig): Promise<{
  ok: boolean;
  shopName: string;
  authMode: AuthMode;
  apiBase: string;
  sample?: unknown;
  tokenPreview?: string;
}> {
  const mode = getAuthMode(config);
  const apiBase = baseUrl(config);

  if (mode === "oauth") {
    const token = await getAccessToken(config);
    return {
      ok: true,
      shopName: config.shopName,
      authMode: mode,
      apiBase,
      tokenPreview: `${token.slice(0, 12)}…`,
    };
  }

  // Lightweight proof: list a page of products
  const res = await apiFetch(config, "/products?page=0&limit=1&full=0");
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Basic API ping failed (${res.status}): ${text.slice(0, 300)}`);
  }

  let sample: unknown = text.slice(0, 200);
  try {
    sample = JSON.parse(text);
  } catch {
    /* keep snippet */
  }

  return {
    ok: true,
    shopName: config.shopName,
    authMode: mode,
    apiBase,
    sample,
  };
}
