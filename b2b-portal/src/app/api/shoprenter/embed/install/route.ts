import { NextResponse } from "next/server";
import { publicAppUrl } from "@/lib/public-app-url";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";
import { getInstallCapability } from "@/lib/shoprenter/install/mode";
import {
  confirmManualInstall,
  installWidgetScript,
  removeWidgetScript,
} from "@/lib/shoprenter/install/provider";
import { getScriptInstallState } from "@/lib/shoprenter/install/shop-script-state";
import {
  buildLegacySnippet,
  buildLoaderSnippet,
  buildWidgetLoaderUrl,
} from "@/lib/shoprenter/install/snippet";
import { WIDGET_JS_ASSET } from "@/lib/widget/asset-version";

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

export async function GET(req: Request) {
  const auth = await requireEmbed();
  if ("error" in auth) return auth.error;

  const apiBase = publicAppUrl(req.headers);
  const script = await getScriptInstallState(auth.shop.shopId);
  const capability = getInstallCapability();
  const loaderUrl = buildWidgetLoaderUrl({
    apiBase,
    publicId: auth.shop.publicId,
    version: WIDGET_JS_ASSET,
  });

  return NextResponse.json({
    ok: true,
    capability,
    script,
    shop: {
      shopName: auth.shop.shopName,
      storeUrl: auth.shop.storeUrl,
      status: auth.shop.status,
      widgetEnabled: auth.shop.widgetEnabled,
      catalogStatus: auth.shop.catalogStatus,
      catalogSyncedAt: auth.shop.catalogSyncedAt,
      hasCredentials: auth.shop.hasCredentials,
      publicId: auth.shop.publicId,
      orgPlan: auth.shop.orgPlan,
      orgStatus: auth.shop.orgStatus,
      trialEndsAt: auth.shop.trialEndsAt,
    },
    snippets: {
      loader: buildLoaderSnippet({
        apiBase,
        publicId: auth.shop.publicId,
        version: WIDGET_JS_ASSET,
      }),
      legacy: buildLegacySnippet({
        apiBase,
        publicId: auth.shop.publicId,
        version: WIDGET_JS_ASSET,
      }),
      loaderUrl,
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireEmbed();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || "install");
  const apiBase = publicAppUrl(req.headers);
  const enableWidget = body.enableWidget !== false;

  if (action === "confirm_manual") {
    const result = await confirmManualInstall({
      shopId: auth.shop.shopId,
      enableWidget,
    });
    const script = await getScriptInstallState(auth.shop.shopId);
    return NextResponse.json({ ok: true, result, script });
  }

  const result = await installWidgetScript({
    shopId: auth.shop.shopId,
    publicId: auth.shop.publicId,
    apiBase,
    enableWidget,
  });
  const script = await getScriptInstallState(auth.shop.shopId);

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        result,
        script,
        snippets: {
          loader: buildLoaderSnippet({
            apiBase,
            publicId: auth.shop.publicId,
            version: WIDGET_JS_ASSET,
          }),
          legacy: buildLegacySnippet({
            apiBase,
            publicId: auth.shop.publicId,
            version: WIDGET_JS_ASSET,
          }),
        },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, result, script });
}

export async function DELETE() {
  const auth = await requireEmbed();
  if ("error" in auth) return auth.error;

  const result = await removeWidgetScript({ shopId: auth.shop.shopId });
  const script = await getScriptInstallState(auth.shop.shopId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, script },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, script });
}
