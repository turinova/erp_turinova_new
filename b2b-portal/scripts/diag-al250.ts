import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (process.env[k] == null) process.env[k] = v;
}

async function main() {
  const { query, withPlatformAdmin } = await import("../src/lib/db");
  const { decryptCredentials } = await import("../src/lib/crypto/credentials");
  const { configFromCredentials } = await import("../src/lib/shoprenter/ping");
  const { apiFetch } = await import("../src/lib/shoprenter/api").catch(() => ({
    apiFetch: null,
  }));

  // Prefer public helpers that exist
  const srApi = await import("../src/lib/shoprenter/api");

  const row = await withPlatformAdmin(async (client) => {
    const shop = await query<{
      id: string;
      shoprenter_shop_name: string;
    }>(
      client,
      `select id, shoprenter_shop_name from shops
       order by updated_at desc nulls last limit 1`,
    );
    const s = shop.rows[0];
    const prod = await query<{
      sku: string;
      external_product_id: string;
      name: string | null;
      active: boolean;
      synced_at: string;
      list_price_net: string | null;
      model_number: string | null;
    }>(
      client,
      `select sku, external_product_id, name, active,
              synced_at::text, list_price_net::text, model_number
       from product_catalog
       where shop_id = $1 and upper(sku) = 'AL250'`,
      [s.id],
    );
    const creds = await query<{
      auth_type: "oauth" | "basic_legacy";
      ciphertext: Buffer;
      iv: Buffer;
      key_version: number;
    }>(
      client,
      `select auth_type, ciphertext, iv, key_version
       from shop_credentials where shop_id = $1`,
      [s.id],
    );
    const c = creds.rows[0];
    const plain = decryptCredentials({
      ciphertext: Buffer.from(c.ciphertext),
      iv: Buffer.from(c.iv),
      key_version: c.key_version,
    });
    const config = configFromCredentials(s.shoprenter_shop_name, plain);
    return { shop: s, prod: prod.rows, config };
  });

  console.log("DB rows:", JSON.stringify(row.prod, null, 2));

  const config = row.config;
  const sku = "AL250";
  const encoded = encodeURIComponent(sku);

  for (const path of [
    `/products?sku=${encoded}&full=1&limit=10`,
    `/products?search=${encoded}&full=1&limit=10`,
  ]) {
    // use fetchProducts-style via getAccessToken path — call list through existing helper if any
    const { getAccessToken, getAuthMode } = srApi as {
      getAccessToken: (c: typeof config) => Promise<string>;
      getAuthMode: (c: typeof config) => string;
    };
    const base =
      getAuthMode(config) === "oauth"
        ? `https://${config.shopName}.api2.myshoprenter.hu/api`
        : `https://${config.shopName}.api.myshoprenter.hu`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (getAuthMode(config) === "oauth") {
      headers.Authorization = `Bearer ${await getAccessToken(config)}`;
    } else {
      const token = Buffer.from(
        `${config.username}:${config.password}`,
        "utf8",
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }
    const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
    const text = await res.text();
    let parsed: unknown = text.slice(0, 800);
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep */
    }
    console.log("\nSR", path, "status", res.status);
    console.log(
      JSON.stringify(parsed, null, 2).slice(0, 1200),
    );
  }

  // Direct by inner id if we have it
  const ext = row.prod[0]?.external_product_id;
  if (ext) {
    const { getAccessToken, getAuthMode } = srApi as {
      getAccessToken: (c: typeof config) => Promise<string>;
      getAuthMode: (c: typeof config) => string;
    };
    const base =
      getAuthMode(config) === "oauth"
        ? `https://${config.shopName}.api2.myshoprenter.hu/api`
        : `https://${config.shopName}.api.myshoprenter.hu`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (getAuthMode(config) === "oauth") {
      headers.Authorization = `Bearer ${await getAccessToken(config)}`;
    } else {
      const token = Buffer.from(
        `${config.username}:${config.password}`,
        "utf8",
      ).toString("base64");
      headers.Authorization = `Basic ${token}`;
    }
    const outer = Buffer.from(
      `product-product_id=${ext}`,
      "utf8",
    ).toString("base64");
    for (const path of [
      `/products/${ext}?full=1`,
      `/products/${encodeURIComponent(outer)}?full=1`,
    ]) {
      const res = await fetch(`${base}${path}`, {
        headers,
        cache: "no-store",
      });
      const text = await res.text();
      console.log("\nSR by id", path, "status", res.status, text.slice(0, 500));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
