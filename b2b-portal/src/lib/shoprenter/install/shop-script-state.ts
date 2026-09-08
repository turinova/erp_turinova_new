import { decryptCredentials } from "@/lib/crypto/credentials";
import { query, withPlatformAdmin } from "@/lib/db";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";
import { configFromCredentials } from "@/lib/shoprenter/ping";
import type {
  InstallMethod,
  ScriptInstallState,
} from "@/lib/shoprenter/install/types";

type CredRow = {
  shop_id: string;
  shoprenter_shop_name: string;
  public_id: string;
  store_url: string | null;
  auth_type: "oauth" | "basic_legacy";
  ciphertext: Buffer;
  iv: Buffer;
  key_version: number;
};

/** Load Shoprenter API config for embed install (ignores widget_enabled). */
export async function loadShopConfigByShopId(
  shopId: string,
): Promise<{ config: ShoprenterConfig; publicId: string } | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<CredRow>(
      client,
      `select
         s.id as shop_id,
         s.shoprenter_shop_name,
         s.public_id,
         s.store_url,
         c.auth_type,
         c.ciphertext,
         c.iv,
         c.key_version
       from shops s
       join shop_credentials c on c.shop_id = s.id
       where s.id = $1
       limit 1`,
      [shopId],
    );
    const row = res.rows[0];
    if (!row) return null;
    const plain = decryptCredentials({
      ciphertext: Buffer.from(row.ciphertext),
      iv: Buffer.from(row.iv),
      key_version: row.key_version,
    });
    const base =
      plain.auth_type === "oauth"
        ? configFromCredentials(row.shoprenter_shop_name, {
            auth_type: "oauth",
            client_id: plain.client_id,
            client_secret: plain.client_secret,
          })
        : configFromCredentials(row.shoprenter_shop_name, {
            auth_type: "basic_legacy",
            username: plain.username,
            password: plain.password,
          });
    const config: ShoprenterConfig = {
      ...base,
      storeUrl: row.store_url ?? undefined,
    };
    return { config, publicId: row.public_id };
  });
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

type ScriptRow = {
  widget_script_method: string | null;
  widget_script_tag_id: string | null;
  widget_script_installed_at: Date | string | null;
  widget_script_verified_at: Date | string | null;
};

export async function getScriptInstallState(
  shopId: string,
): Promise<ScriptInstallState> {
  return withPlatformAdmin(async (client) => {
    try {
      const res = await query<ScriptRow>(
        client,
        `select
           widget_script_method,
           widget_script_tag_id,
           widget_script_installed_at,
           widget_script_verified_at
         from shops
         where id = $1
         limit 1`,
        [shopId],
      );
      const row = res.rows[0];
      if (!row) {
        return {
          method: null,
          scriptTagId: null,
          installedAt: null,
          verifiedAt: null,
        };
      }
      const method = row.widget_script_method as InstallMethod | null;
      return {
        method:
          method === "manual" || method === "script_tag" || method === "stub"
            ? method
            : null,
        scriptTagId: row.widget_script_tag_id,
        installedAt: toIso(row.widget_script_installed_at),
        verifiedAt: toIso(row.widget_script_verified_at),
      };
    } catch {
      // Column missing until 040 migration is applied.
      return {
        method: null,
        scriptTagId: null,
        installedAt: null,
        verifiedAt: null,
      };
    }
  });
}

export async function setScriptInstalled(
  shopId: string,
  opts: {
    method: InstallMethod;
    scriptTagId?: string | null;
    enableWidget?: boolean;
  },
): Promise<void> {
  await withPlatformAdmin(async (client) => {
    try {
      await query(
        client,
        `update shops
         set widget_script_method = $2,
             widget_script_tag_id = $3,
             widget_script_installed_at = coalesce(widget_script_installed_at, now()),
             widget_enabled = case when $4 then true else widget_enabled end,
             updated_at = now()
         where id = $1`,
        [
          shopId,
          opts.method,
          opts.scriptTagId ?? null,
          Boolean(opts.enableWidget),
        ],
      );
    } catch (err) {
      console.error("[setScriptInstalled] run sql/040_shop_widget_script.sql?", err);
      throw err;
    }
  });
}

export async function clearScriptInstalled(shopId: string): Promise<void> {
  await withPlatformAdmin(async (client) => {
    try {
      await query(
        client,
        `update shops
         set widget_script_method = null,
             widget_script_tag_id = null,
             widget_script_installed_at = null,
             widget_script_verified_at = null,
             updated_at = now()
         where id = $1`,
        [shopId],
      );
    } catch (err) {
      console.error("[clearScriptInstalled]", err);
      throw err;
    }
  });
}
