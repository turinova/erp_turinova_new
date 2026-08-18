import {
  getShoprenterConfigForRequest,
  getAuthMode,
} from "@/lib/shoprenter";
import { jsonWithCors, optionsCors } from "@/lib/cors";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

/** Dev helper: sample products, or ?q=CODE to probe sku/model/gtin/search filters. */
export async function GET(request: Request) {
  try {
    const config = await getShoprenterConfigForRequest(request);
    const mode = getAuthMode(config);
    const base =
      mode === "oauth"
        ? `https://${config.shopName}.api2.myshoprenter.hu/api`
        : `https://${config.shopName}.api.myshoprenter.hu`;

    let auth: string;
    if (mode === "oauth") {
      const { getAccessToken } = await import("@/lib/shoprenter");
      auth = `Bearer ${await getAccessToken(config)}`;
    } else {
      auth = `Basic ${Buffer.from(`${config.username}:${config.password}`, "utf8").toString("base64")}`;
    }

    const scan = new URL(request.url).searchParams.get("scan")?.trim();
    if (scan) {
      const key = scan.toUpperCase();
      const matches: {
        page: number;
        sku: unknown;
        modelNumber: unknown;
        gtin: unknown;
        status: unknown;
        innerId: unknown;
      }[] = [];
      let pageCount = 1;
      let scanned = 0;
      for (let page = 0; page < 200; page++) {
        const res = await fetch(
          `${base}/products?page=${page}&limit=100&full=1`,
          {
            headers: { Authorization: auth, Accept: "application/json" },
            cache: "no-store",
          },
        );
        if (!res.ok) {
          return jsonWithCors(request, {
            scan,
            error: await res.text(),
            status: res.status,
            page,
          });
        }
        const data = (await res.json()) as {
          items?: Record<string, unknown>[];
          pageCount?: number;
        };
        if (typeof data.pageCount === "number") pageCount = data.pageCount;
        const items = data.items ?? [];
        if (!items.length) break;
        scanned += items.length;
        for (const item of items) {
          const fields = [item.sku, item.modelNumber, item.gtin, item.ean];
          const hit = fields.some(
            (v) =>
              v != null &&
              String(v).trim().toUpperCase() === key,
          );
          if (hit) {
            matches.push({
              page,
              sku: item.sku,
              modelNumber: item.modelNumber,
              gtin: item.gtin,
              status: item.status,
              innerId: item.innerId,
            });
          }
        }
        if (page + 1 >= pageCount) break;
      }
      return jsonWithCors(request, {
        scan,
        pageCount,
        scanned,
        matchCount: matches.length,
        matches,
      });
    }

    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (q) {
      const encoded = encodeURIComponent(q);
      const paths = [
        `/products?sku=${encoded}&full=1&limit=5`,
        `/products?modelNumber=${encoded}&full=1&limit=5`,
        `/products?model=${encoded}&full=1&limit=5`,
        `/products?gtin=${encoded}&full=1&limit=5`,
        `/products?ean=${encoded}&full=1&limit=5`,
        `/products?search=${encoded}&full=1&limit=10`,
        `/productExtend?sku=${encoded}&full=1&limit=5`,
        `/productExtend?modelNumber=${encoded}&full=1&limit=5`,
        `/productExtend?search=${encoded}&full=1&limit=10`,
      ];
      const probes = [];
      for (const path of paths) {
        const res = await fetch(`${base}${path}`, {
          headers: { Authorization: auth, Accept: "application/json" },
          cache: "no-store",
        });
        const text = await res.text();
        let itemCount = 0;
        let sample: unknown = null;
        try {
          const data = JSON.parse(text) as {
            items?: Record<string, unknown>[];
            sku?: string;
            modelNumber?: string;
            gtin?: string;
          };
          if (data.sku || data.modelNumber) {
            itemCount = 1;
            sample = {
              sku: data.sku,
              modelNumber: data.modelNumber,
              gtin: data.gtin,
            };
          } else if (Array.isArray(data.items)) {
            itemCount = data.items.length;
            sample = data.items.slice(0, 3).map((it) => ({
              sku: it.sku,
              modelNumber: it.modelNumber,
              gtin: it.gtin,
            }));
          }
        } catch {
          sample = text.slice(0, 160);
        }
        probes.push({
          path,
          status: res.status,
          itemCount,
          sample,
        });
      }
      return jsonWithCors(request, { q, probes });
    }

    const res = await fetch(`${base}/products?page=0&limit=5&full=1`, {
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return jsonWithCors(
        request,
        { error: text.slice(0, 500) },
        { status: res.status },
      );
    }

    const data = JSON.parse(text) as {
      items?: Record<string, unknown>[];
    };

    const items = (data.items ?? []).map((item) => {
      const id = item.id;
      let productId: number | null = null;
      if (typeof id === "string") {
        try {
          const decoded = Buffer.from(id, "base64").toString("utf8");
          const m = decoded.match(/product_id=(\d+)/i);
          if (m) productId = Number(m[1]);
        } catch {
          /* ignore */
        }
      }
      return {
        resourceId: id,
        productId,
        sku: item.sku,
        modelNumber: item.modelNumber,
        gtin: item.gtin,
        nameHint: item.sku,
        rawKeys: Object.keys(item),
      };
    });

    return jsonWithCors(request, { count: items.length, items, rawFirst: data.items?.[0] });
  } catch (e) {
    return jsonWithCors(
      request,
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
