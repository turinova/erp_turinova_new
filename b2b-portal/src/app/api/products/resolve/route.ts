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
      const qtyByIndex = body.lines?.map((l) =>
        Math.max(1, Math.round(Number(l.quantity) || 1)),
      );
      const products = await resolveProductsBySkus(
        shop.config,
        skus,
        groupId,
        qtyByIndex,
      );
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
        error: "Katalógus még szinkronizál. Próbáld pár perc múlva.",
        catalogReady: false,
        catalogStatus: packed.meta.catalogStatus,
        products: skus.map((s) => notFound(s.trim())),
      });
    }

    const qtyByIndex = skus.map((_, i) => {
      const fromLine = body.lines?.[i]?.quantity;
      return Math.max(1, Math.round(Number(fromLine) || 1));
    });

    const cache = new Map<string, ResolvedProduct>();
    const jobs: { key: string; code: string; qty: number }[] = [];
    for (let i = 0; i < skus.length; i++) {
      const code = skus[i].trim();
      const qty = qtyByIndex[i] ?? 1;
      if (!code || !packed.rows.has(code)) continue;
      const key = `${code}:${qty}`;
      if (!cache.has(key) && !jobs.some((j) => j.key === key)) {
        jobs.push({ key, code, qty });
      }
    }

    await mapLimit(jobs, 4, async (job) => {
      const row = packed.rows!.get(job.code)!;
      try {
        const live = await resolveProductByExactSku(
          shop.config,
          row.sku,
          groupId,
          job.qty,
        );
        if (live.found) {
          cache.set(job.key, {
            ...live,
            sku: live.sku || row.sku,
            modelNumber: live.modelNumber || row.model_number || undefined,
            gtin: live.gtin || row.gtin || undefined,
            name: live.name || row.name || undefined,
          });
        } else {
          cache.set(job.key, {
            ...live,
            sku: row.sku,
            error: live.error || "not found",
          });
        }
      } catch (e) {
        cache.set(job.key, {
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

    return jsonWithCors(request, {
      products: skus.map((s, i) => {
        const key = s.trim();
        const qty = qtyByIndex[i] ?? 1;
        if (!key || !packed.rows!.has(key)) {
          return { ...notFound(key), quantity: qty };
        }
        const p = cache.get(`${key}:${qty}`) ?? notFound(key);
        return { ...p, quantity: qty };
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
