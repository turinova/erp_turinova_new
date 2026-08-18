import { jsonWithCors, optionsCors } from "@/lib/cors";
import {
  catalogIsSearchable,
  lookupCatalogCode,
  loadShopCatalogStatus,
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

    const meta = await withPlatformAdmin((client) =>
      loadShopCatalogStatus(client, shop.shopId),
    );

    if (!catalogIsSearchable(meta.catalogStatus)) {
      return jsonWithCors(request, {
        error: "Katalógus még szinkronizál — próbáld pár perc múlva.",
        catalogReady: false,
        catalogStatus: meta.catalogStatus,
        products: skus.map((s) => notFound(s.trim())),
      });
    }

    const unique = [...new Set(skus.map((s) => s.trim()).filter(Boolean))];
    const byQuery = new Map<string, ResolvedProduct>();

    for (const code of unique) {
      const row = await withPlatformAdmin((client) =>
        lookupCatalogCode(client, shop.shopId, code),
      );
      if (!row) {
        byQuery.set(code, notFound(code));
        continue;
      }
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
    }

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
