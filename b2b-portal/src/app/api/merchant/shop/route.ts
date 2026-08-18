import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  loadMerchantShop,
  updateMerchantShop,
} from "@/lib/merchant/shop";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const dto = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) => loadMerchantShop(client, auth.activeOrganizationId!),
    );
    if (!dto) {
      return NextResponse.json(
        { error: "Nincs shop ehhez a szervezethez" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, shop: dto });
  } catch (err) {
    console.error("[GET merchant/shop]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
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
    const dto = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        updateMerchantShop(client, auth.activeOrganizationId!, auth.userId, {
          storeUrl:
            body.storeUrl === undefined ? undefined : String(body.storeUrl ?? ""),
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
          widgetEnabled:
            body.widgetEnabled === undefined
              ? undefined
              : Boolean(body.widgetEnabled),
          origins,
        }),
    );
    return NextResponse.json({ ok: true, shop: dto });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NO_SHOP") {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    if (code === "INVALID_STORE_URL") {
      return NextResponse.json({ error: "Érvénytelen Store URL" }, { status: 400 });
    }
    if (code === "BASIC_INCOMPLETE") {
      return NextResponse.json(
        { error: "Felhasználónév és jelszó kell" },
        { status: 400 },
      );
    }
    console.error("[PATCH merchant/shop]", err);
    return NextResponse.json({ error: "Mentés sikertelen" }, { status: 500 });
  }
}
