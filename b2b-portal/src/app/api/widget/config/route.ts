import { jsonWithCors, optionsCors } from "@/lib/cors";
import { loadPublicWidgetConfig } from "@/lib/widget/settings";
import { FAB_POSITION_PRESETS, positionCss } from "@/lib/widget/presets";

export async function OPTIONS(request: Request) {
  return optionsCors(request);
}

/** Public storefront config — no auth; keyed by shops.public_id */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shopId =
      url.searchParams.get("shopId") ||
      url.searchParams.get("publicId") ||
      request.headers.get("x-shop-id") ||
      "";
    if (!shopId.trim()) {
      return jsonWithCors(
        request,
        { error: "shopId required" },
        { status: 400 },
      );
    }

    const config = await loadPublicWidgetConfig(shopId.trim());
    if (!config) {
      return jsonWithCors(request, { error: "Ismeretlen shopId" }, { status: 404 });
    }

    const pos = FAB_POSITION_PRESETS.find((p) => p.id === config.fabPosition);
    return jsonWithCors(request, {
      ok: true,
      config: {
        ...config,
        positionCss: positionCss(config.fabPosition),
        positionMobileBottom: pos?.css.bottom,
      },
    });
  } catch (err) {
    console.error("[GET widget/config]", err);
    return jsonWithCors(
      request,
      { error: err instanceof Error ? err.message : "config failed" },
      { status: 500 },
    );
  }
}
