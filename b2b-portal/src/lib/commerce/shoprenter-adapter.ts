import { pickPackRules } from "@/lib/shoprenter/api";
import {
  fetchProductsPage,
  PRODUCTS_PAGE_LIMIT,
  type ShoprenterConfig,
} from "@/lib/shoprenter/api";
import { pingAuth } from "@/lib/shoprenter/ping";
import type { CatalogProductDraft, CommerceAdapter, ProductPage } from "./types";

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
  if (s === 0 || s === "0" || s === false) return false;
  if (s === "inactive" || s === "disabled") return false;
  return true;
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
  const name =
    (typeof item.name === "string" && item.name.trim()) ||
    (typeof item.imageAlt === "string" && item.imageAlt.trim()) ||
    "";
  const pack = pickPackRules(item);
  const cost =
    toNumber(item.cost) ??
    toNumber(item.costPrice) ??
    toNumber(item.purchasePrice);
  const price = toNumber(item.price);

  return {
    externalProductId: externalId(item, sku),
    sku,
    modelNumber: model || null,
    gtin: gtinRaw || null,
    name: name || null,
    active: isActive(item),
    minQty: pack.minQty,
    qtyStep: pack.qtyStep,
    costNet: cost != null && cost > 0 ? cost : null,
    listPriceNet: price != null && Number.isFinite(price) ? price : null,
  };
}

export function createShoprenterAdapter(
  config: ShoprenterConfig,
): CommerceAdapter {
  return {
    platform: "shoprenter",
    rateLimit: { maxRps: 2.5, pageDelayMs: 400 },
    async ping() {
      const r = await pingAuth(config);
      return r.ok;
    },
    async listProductsPage(cursor) {
      const page = cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
      const res = await fetchProductsPage(config, page, PRODUCTS_PAGE_LIMIT);
      if (!res.ok) {
        const err = new Error(
          `Shoprenter products HTTP ${res.status}: ${res.body}`,
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const items = res.items
        .map(mapShoprenterItem)
        .filter((d): d is CatalogProductDraft => d != null);
      const nextPage = page + 1;
      const done = items.length === 0 || nextPage >= res.pageCount;
      return {
        items,
        nextCursor: done ? null : String(nextPage),
        pageCount: res.pageCount,
      } satisfies ProductPage;
    },
  };
}
