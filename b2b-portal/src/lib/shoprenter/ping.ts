/**
 * Minimal Shoprenter auth ping for merchant settings.
 * (Subset of shoprenter-b2b-quickorder/src/lib/shoprenter.ts)
 */

export type ShoprenterConfig = {
  shopName: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
};

export type AuthMode = "oauth" | "basic";

export function getAuthMode(config: ShoprenterConfig): AuthMode {
  if (config.clientId && config.clientSecret) return "oauth";
  return "basic";
}

function api2BaseUrl(shopName: string): string {
  return `https://${shopName}.api2.myshoprenter.hu/api`;
}

function apiClassicBaseUrl(shopName: string): string {
  return `https://${shopName}.api.myshoprenter.hu`;
}

async function getAccessToken(config: ShoprenterConfig): Promise<string> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("OAuth client credentials hiányoznak");
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
    throw new Error(`Token kérés sikertelen (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

/** Prove credentials work against Shoprenter. */
export async function pingAuth(config: ShoprenterConfig): Promise<{
  ok: boolean;
  shopName: string;
  authMode: AuthMode;
  apiBase: string;
}> {
  const mode = getAuthMode(config);
  if (mode === "oauth") {
    await getAccessToken(config);
    return {
      ok: true,
      shopName: config.shopName,
      authMode: mode,
      apiBase: api2BaseUrl(config.shopName),
    };
  }

  if (!config.username || !config.password) {
    throw new Error("Basic auth felhasználónév/jelszó hiányzik");
  }

  const apiBase = apiClassicBaseUrl(config.shopName);
  const res = await fetch(`${apiBase}/products?page=0&limit=1&full=0`, {
    headers: {
      Authorization: basicAuthHeader(config.username, config.password),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Basic API ping sikertelen (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  return {
    ok: true,
    shopName: config.shopName,
    authMode: mode,
    apiBase,
  };
}

export function configFromCredentials(
  shopName: string,
  plain: {
    auth_type: "oauth" | "basic_legacy";
    client_id?: string;
    client_secret?: string;
    username?: string;
    password?: string;
  },
): ShoprenterConfig {
  if (plain.auth_type === "oauth") {
    return {
      shopName,
      clientId: plain.client_id,
      clientSecret: plain.client_secret,
    };
  }
  return {
    shopName,
    username: plain.username,
    password: plain.password,
  };
}
