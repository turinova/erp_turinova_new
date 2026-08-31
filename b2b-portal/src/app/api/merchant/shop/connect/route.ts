import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireSettingsAdminApi,
} from "@/lib/auth/merchant-api";
import { kickBootstrapWorkers } from "@/lib/commerce/bootstrap";
import { withTenant } from "@/lib/db";
import {
  loadMerchantShop,
  pingMerchantShop,
  updateMerchantShop,
} from "@/lib/merchant/shop";

/**
 * Egy lépés: mentés + kapcsolat teszt + teljes bootstrap (termékek, csoportok, rendelések).
 */
export async function POST(req: Request) {
  const auth = await requireSettingsAdminApi();
  if (isErrorResponse(auth)) return auth;

  const orgId = auth.activeOrganizationId!;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* üres body OK, ha már mentve van a kulcs */
  }

  const customerGroupIds = Array.isArray(body.customerGroupIds)
    ? (body.customerGroupIds as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
    : undefined;

  const origins = Array.isArray(body.origins)
    ? (body.origins as unknown[]).map(String)
    : undefined;

  try {
    const result = await withTenant(
      { organizationId: orgId, userId: auth.userId },
      async (client) => {
        const existing = await loadMerchantShop(client, orgId);
        if (!existing) return { error: "NO_SHOP" as const };

        const hasNewCreds =
          Boolean(String(body.username ?? "").trim()) ||
          Boolean(String(body.password ?? "").trim()) ||
          !existing.hasCredentials;

        if (hasNewCreds) {
          const username = String(body.username ?? "").trim();
          const password = String(body.password ?? "").trim();
          if (!username || !password) {
            return { error: "CREDS_REQUIRED" as const };
          }
        }

        if (
          body.storeUrl !== undefined ||
          body.username !== undefined ||
          body.password !== undefined ||
          body.buttonLabel !== undefined ||
          customerGroupIds !== undefined ||
          origins !== undefined
        ) {
          await updateMerchantShop(client, orgId, auth.userId, {
            storeUrl:
              body.storeUrl === undefined
                ? undefined
                : String(body.storeUrl ?? ""),
            authType: "basic_legacy",
            username:
              body.username === undefined ? undefined : String(body.username),
            password:
              body.password === undefined ? undefined : String(body.password),
            buttonLabel:
              body.buttonLabel === undefined
                ? undefined
                : String(body.buttonLabel),
            customerGroupIds,
            origins,
          });
        }

        const ping = await pingMerchantShop(client, orgId, auth.userId);
        return { ping };
      },
    );

    if ("error" in result) {
      if (result.error === "NO_SHOP") {
        return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
      }
      if (result.error === "CREDS_REQUIRED") {
        return NextResponse.json(
          { error: "Írd be a Shoprenter nevet és jelszót." },
          { status: 400 },
        );
      }
    }

    kickBootstrapWorkers();
    const ping = result.ping!;
    return NextResponse.json({
      ok: ping.ok,
      error: ping.error,
      shop: ping.dto,
    });
  } catch (err) {
    console.error("[POST merchant/shop/connect]", err);
    const msg = err instanceof Error ? err.message : "Összekötés sikertelen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
