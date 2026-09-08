import { NextResponse } from "next/server";
import { withTenant } from "@/lib/db";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";
import {
  loadMerchantWidget,
  updateMerchantWidget,
} from "@/lib/widget/settings";
import {
  normalizeWidgetSettings,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";

async function requireEmbed() {
  const session = await getEmbedSessionFromCookies();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Nincs embed session — nyisd meg az appot a Shoprenterből" },
        { status: 401 },
      ),
    } as const;
  }
  const shop = await findEmbedShopById(session.shopId);
  if (!shop || shop.status === "uninstalled") {
    return {
      error: NextResponse.json(
        { error: "A bolt nincs összekötve vagy el lett távolítva" },
        { status: 404 },
      ),
    } as const;
  }
  return { session, shop } as const;
}

export async function GET() {
  const auth = await requireEmbed();
  if ("error" in auth) return auth.error;

  try {
    const dto = await withTenant(
      {
        organizationId: auth.session.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      (client) =>
        loadMerchantWidget(client, auth.session.organizationId),
    );
    if (!dto) {
      return NextResponse.json(
        { error: "Nincs widget beállítás ehhez a bolthoz" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      shop: {
        shopName: auth.shop.shopName,
        storeUrl: auth.shop.storeUrl,
        status: auth.shop.status,
        widgetEnabled: auth.shop.widgetEnabled,
        catalogStatus: auth.shop.catalogStatus,
        catalogSyncedAt: auth.shop.catalogSyncedAt,
        hasCredentials: auth.shop.hasCredentials,
        orgPlan: auth.shop.orgPlan,
        orgStatus: auth.shop.orgStatus,
        trialEndsAt: auth.shop.trialEndsAt,
      },
      widget: dto,
    });
  } catch (err) {
    console.error("[GET shoprenter/embed/widget]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireEmbed();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const settings =
    body.settings !== undefined
      ? normalizeWidgetSettings(body.settings)
      : undefined;

  try {
    const dto = await withTenant(
      {
        organizationId: auth.session.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      (client) =>
        updateMerchantWidget(client, auth.session.organizationId, null, {
          widgetEnabled:
            body.widgetEnabled === undefined
              ? undefined
              : Boolean(body.widgetEnabled),
          buttonLabel:
            body.buttonLabel === undefined
              ? undefined
              : String(body.buttonLabel),
          settings: settings as WidgetSettingsPayload | undefined,
        }),
    );
    return NextResponse.json({ ok: true, widget: dto });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NO_SHOP") {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    console.error("[PATCH shoprenter/embed/widget]", err);
    return NextResponse.json({ error: "Mentés sikertelen" }, { status: 500 });
  }
}
