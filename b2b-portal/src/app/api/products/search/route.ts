import { jsonWithCors, optionsCors } from "@/lib/cors";
import {
  catalogIsSearchable,
  catalogRowToHit,
  loadShopCatalogStatus,
  searchCatalog,
} from "@/lib/commerce/lookup";
import { withPlatformAdmin } from "@/lib/db";
import {
  getShoprenterConfigForRequest,
  resolveShopContextForRequest,
  searchProducts,
} from "@/lib/shoprenter";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

function useLegacySearch(): boolean {
  return process.env.PRODUCT_SEARCH_SOURCE === "legacy";
}

/** Typeahead: GET /api/products/search?q=SS&limit=8 — Postgres when catalog ready. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Number(url.searchParams.get("limit") || "8");
    if (q.length < 2) {
      return jsonWithCors(request, { products: [], catalogReady: true });
    }

    if (useLegacySearch()) {
      const config = await getShoprenterConfigForRequest(request);
      const products = await searchProducts(config, q, limit);
      return jsonWithCors(request, { products, source: "legacy" });
    }

    const shop = await resolveShopContextForRequest(request);

    // One DB round-trip: status + search (was two separate withPlatformAdmin calls).
    const result = await withPlatformAdmin(async (client) => {
      const meta = await loadShopCatalogStatus(client, shop.shopId);
      const catalogReady = catalogIsSearchable(meta.catalogStatus);
      if (!catalogReady) {
        return {
          products: [] as ReturnType<typeof catalogRowToHit>[],
          catalogReady: false as const,
          catalogStatus: meta.catalogStatus,
        };
      }
      const rows = await searchCatalog(client, shop.shopId, q, limit);
      return {
        products: rows.map(catalogRowToHit),
        catalogReady: true as const,
        catalogStatus: meta.catalogStatus,
      };
    });

    return jsonWithCors(request, { ...result, source: "db" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search failed";
    return jsonWithCors(request, { error: msg, products: [] }, { status: 500 });
  }
}
