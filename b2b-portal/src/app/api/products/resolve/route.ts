import { jsonWithCors, optionsCors } from "@/lib/cors";
import {
  catalogIsSearchable,
  lookupCatalogCodes,
  loadShopCatalogStatus,
  type CatalogRow,
} from "@/lib/commerce/lookup";
import { withPlatformAdmin } from "@/lib/db";
import {
  resolveProductByExactSku,
  resolveProductsBySkus,
  resolveShopContextForRequest,
  type ResolvedProduct,
} from "@/lib/shoprenter";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

type Body = {
  skus?: string[];
  lines?: { sku: string; quantity?: number }[];
  customerGroupId?: number | string;
  userGroupId?: number | string;
};

function useLegacySearch(): boolean {
  return process.env.PRODUCT_SEARCH_SOURCE === "legacy";
}

function notFound(code: string): ResolvedProduct {
  return {
    sku: code,
    productId: null,
    found: false,
    error: "not found",
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  const n = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const fromSkus = body.skus ?? [];
    const fromLines = (body.lines ?? []).map((l) => l.sku);
    const skus = [...fromSkus, ...fromLines];

    if (skus.length === 0) {
      return jsonWithCors(
        request,
        { error: "Provide skus[] or lines[].sku" },
        { status: 400 },
      );
    }

    if (skus.length > 200) {
      return jsonWithCors(
        request,
        { error: "Max 200 SKUs per request (prototype limit)" },
        { status: 400 },
      );
    }

    const rawGroup = body.customerGroupId ?? body.userGroupId;
    const customerGroupInnerId =
      rawGroup != null && String(rawGroup).trim() !== ""
        ? Number(rawGroup)
        : null;
    const groupId =
      customerGroupInnerId != null && Number.isFinite(customerGroupInnerId)
        ? customerGroupInnerId
        : null;

    const shop = await resolveShopContextForRequest(request, {
      body: body as Record<string, unknown>,
    });

    if (useLegacySearch()) {
      const products = await resolveProductsBySkus(shop.config, skus, groupId);
      const qtyByIndex = body.lines?.map((l) => l.quantity ?? 1);
      return jsonWithCors(request, {
        products: products.map((p, i) => ({
          ...p,
          quantity: qtyByIndex?.[i] ?? 1,
        })),
        source: "legacy",
      });
    }

    const unique = [...new Set(skus.map((s) => s.trim()).filter(Boolean))];
    const packed = await withPlatformAdmin(async (client) => {
      const meta = await loadShopCatalogStatus(client, shop.shopId);
      if (!catalogIsSearchable(meta.catalogStatus)) {
        return { meta, rows: null as Map<string, CatalogRow> | null };
      }
      const rows = await lookupCatalogCodes(client, shop.shopId, unique);
      return { meta, rows };
    });

    if (!catalogIsSearchable(packed.meta.catalogStatus) || !packed.rows) {
      return jsonWithCors(request, {
        error: "Katalógus még szinkronizál — próbáld pár perc múlva.",
        catalogReady: false,
        catalogStatus: packed.meta.catalogStatus,
        products: skus.map((s) => notFound(s.trim())),
      });
    }

    const byQuery = new Map<string, ResolvedProduct>();
    const foundCodes = unique.filter((code) => packed.rows!.has(code));
    const missingCodes = unique.filter((code) => !packed.rows!.has(code));
    for (const code of missingCodes) byQuery.set(code, notFound(code));

    await mapLimit(foundCodes, 4, async (code) => {
      const row = packed.rows!.get(code)!;
      try {
        const live = await resolveProductByExactSku(
          shop.config,
          row.sku,
          groupId,
        );
        if (live.found) {
          byQuery.set(code, {
            ...live,
            sku: live.sku || row.sku,
            modelNumber: live.modelNumber || row.model_number || undefined,
            gtin: live.gtin || row.gtin || undefined,
            name: live.name || row.name || undefined,
          });
        } else {
          byQuery.set(code, {
            ...live,
            sku: row.sku,
            error: live.error || "not found",
          });
        }
      } catch (e) {
        byQuery.set(code, {
          sku: row.sku,
          productId: /^\d+$/.test(row.external_product_id)
            ? Number(row.external_product_id)
            : null,
          name: row.name ?? undefined,
          modelNumber: row.model_number ?? undefined,
          found: false,
          error: e instanceof Error ? e.message : "resolve failed",
        });
      }
    });

    const qtyByIndex = body.lines?.map((l) => l.quantity ?? 1);
    return jsonWithCors(request, {
      products: skus.map((s, i) => {
        const key = s.trim();
        const p = byQuery.get(key) ?? notFound(key);
        return { ...p, quantity: qtyByIndex?.[i] ?? 1 };
      }),
      catalogReady: true,
      source: "db",
    });
  } catch (e) {
    return jsonWithCors(
      request,
      {
        error: e instanceof Error ? e.message : "resolve failed",
      },
      { status: 500 },
    );
  }
}
