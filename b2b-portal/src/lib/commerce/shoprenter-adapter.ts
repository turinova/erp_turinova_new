import {
  buildProductImageUrl,
  fetchCategoriesMap,
  fetchManufacturersMap,
  fetchProductCategoryLinks,
  fetchProductsPage,
  pickCategoryInnerIds,
  pickManufacturerRef,
  pickPackRules,
  pickProductDisplayName,
  PRODUCTS_PAGE_LIMIT,
  resolveProductDisplayName,
  type CategoryMeta,
  type ProductCategoryLink,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { pingAuth } from "@/lib/shoprenter/ping";
import type { CatalogProductDraft, CommerceAdapter, ProductPage } from "./types";

export type { CategoryMeta, ProductCategoryLink };

export type ShoprenterAdapter = CommerceAdapter & {
  getCategoriesMeta(): Promise<Map<number, CategoryMeta>>;
  getProductCategoryLinks(): Promise<ProductCategoryLink[]>;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/\s/g, "").replace(",", "."));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function isActive(item: Record<string, unknown>): boolean {
  const s = item.status;
  // Shoprenter: 1 / "1" = engedélyezett; 0 = tiltott. Hiányzó status → aktív (régi payload).
  if (s == null || s === "") return true;
  if (s === 1 || s === "1" || s === true) return true;
  if (typeof s === "string") {
    const t = s.trim().toLowerCase();
    if (t === "1" || t === "active" || t === "enabled" || t === "true") {
      return true;
    }
    return false;
  }
  return false;
}

function externalId(item: Record<string, unknown>, sku: string): string {
  const raw =
    item.innerId ??
    item.productId ??
    item.product_id ??
    item.id;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string" && raw.trim()) {
    if (/^\d+$/.test(raw.trim())) return raw.trim();
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      const match = decoded.match(/product_id=(\d+)/i);
      if (match) return match[1];
    } catch {
      /* ignore */
    }
    return raw.trim();
  }
  return sku;
}

export function mapShoprenterItem(
  item: Record<string, unknown>,
  shopName?: string,
  manufacturerNames?: Map<number, string>,
): CatalogProductDraft | null {
  const sku =
    typeof item.sku === "string" && item.sku.trim() ? item.sku.trim() : "";
  if (!sku) return null;

  const model =
    typeof item.modelNumber === "string"
      ? item.modelNumber.trim()
      : typeof item.modelNumber === "number"
        ? String(item.modelNumber)
        : "";
  const gtinRaw =
    (typeof item.gtin === "string" && item.gtin.trim()) ||
    (typeof item.ean === "string" && item.ean.trim()) ||
    (typeof item.gtin === "number" ? String(item.gtin) : "");
  const name = pickProductDisplayName(item) || "";
  const pack = pickPackRules(item);
  const cost =
    toNumber(item.cost) ??
    toNumber(item.costPrice) ??
    toNumber(item.purchasePrice);
  const price = toNumber(item.price);
  const mfr = pickManufacturerRef(item, manufacturerNames);
  const categoryInnerIds = pickCategoryInnerIds(item);

  return {
    externalProductId: externalId(item, sku),
    sku,
    modelNumber: model || null,
    gtin: gtinRaw || null,
    name: name || null,
    manufacturerInnerId: mfr?.innerId ?? null,
    manufacturerName: mfr?.name ?? null,
    categoryInnerIds: categoryInnerIds.length ? categoryInnerIds : undefined,
    active: isActive(item),
    minQty: pack.minQty,
    qtyStep: pack.qtyStep,
    costNet: cost != null && cost > 0 ? cost : null,
    listPriceNet: price != null && Number.isFinite(price) ? price : null,
    imageUrl: shopName
      ? buildProductImageUrl(shopName, item.mainPicture) ?? null
      : null,
  };
}

export function createShoprenterAdapter(
  config: ShoprenterConfig,
): ShoprenterAdapter {
  let manufacturerNames: Map<number, string> | null = null;
  let categoriesMeta: Map<number, CategoryMeta> | null = null;

  async function ensureManufacturerNames(): Promise<Map<number, string>> {
    if (manufacturerNames) return manufacturerNames;
    try {
      manufacturerNames = await fetchManufacturersMap(config);
    } catch {
      manufacturerNames = new Map();
    }
    return manufacturerNames;
  }

  async function ensureCategoriesMeta(): Promise<Map<number, CategoryMeta>> {
    if (categoriesMeta) return categoriesMeta;
    try {
      categoriesMeta = await fetchCategoriesMap(config);
    } catch {
      categoriesMeta = new Map();
    }
    return categoriesMeta;
  }

  return {
    platform: "shoprenter",
    rateLimit: { maxRps: 2.5, pageDelayMs: 400 },
    getCategoriesMeta: ensureCategoriesMeta,
    async getProductCategoryLinks() {
      try {
        return await fetchProductCategoryLinks(config);
      } catch (e) {
        console.warn("[shoprenter] productCategoryRelations", e);
        return [];
      }
    },
    async ping() {
      const r = await pingAuth(config);
      return r.ok;
    },
    async listProductsPage(cursor) {
      const page = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
      const mfrNames = await ensureManufacturerNames();
      if (page === 0) {
        await ensureCategoriesMeta();
      }
      const res = await fetchProductsPage(config, page, PRODUCTS_PAGE_LIMIT);
      if (!res.ok) {
        const err = new Error(
          `Shoprenter products HTTP ${res.status}: ${res.body}`,
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      type Row = {
        draft: NonNullable<ReturnType<typeof mapShoprenterItem>>;
        item: Record<string, unknown>;
      };
      const rows: Row[] = [];
      for (const item of res.items) {
        const draft = mapShoprenterItem(item, config.shopName, mfrNames);
        if (!draft) continue;
        rows.push({ draft, item });
      }

      // A lista full=1 gyakran üres name-et ad; a név productDescriptions-ben van.
      // Korábban max 25 / oldal → ~549 termék névtelen maradt (pl. AL250).
      const needName = rows.filter((r) => !r.draft.name?.trim());
      const NAME_CONCURRENCY = 3;
      const NAME_DELAY_MS = 80;
      let cursorIdx = 0;
      async function nameWorker() {
        while (cursorIdx < needName.length) {
          const i = cursorIdx++;
          const row = needName[i];
          const inner = Number(row.draft.externalProductId);
          try {
            const resolved = await resolveProductDisplayName(config, {
              productItem: row.item,
              productInnerId: Number.isFinite(inner) ? inner : null,
            });
            if (resolved) row.draft.name = resolved;
          } catch {
            /* egy termék ne állítsa meg az oldalt */
          }
          await new Promise((r) => setTimeout(r, NAME_DELAY_MS));
        }
      }
      if (needName.length) {
        await Promise.all(
          Array.from(
            { length: Math.min(NAME_CONCURRENCY, needName.length) },
            () => nameWorker(),
          ),
        );
      }

      const nextPage = page + 1;
      const drafts = rows.map((r) => r.draft);
      const done = drafts.length === 0 || nextPage >= res.pageCount;
      return {
        items: drafts,
        nextCursor: done ? null : String(nextPage),
        pageCount: res.pageCount,
      } satisfies ProductPage;
    },
  };
}
