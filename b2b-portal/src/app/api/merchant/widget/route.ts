import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  loadMerchantWidget,
  updateMerchantWidget,
} from "@/lib/widget/settings";
import {
  normalizeWidgetSettings,
  type WidgetSettingsPayload,
} from "@/lib/widget/presets";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const dto = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) => loadMerchantWidget(client, auth.activeOrganizationId!),
    );
    if (!dto) {
      return NextResponse.json(
        { error: "Nincs shop ehhez a szervezethez" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, widget: dto });
  } catch (err) {
    console.error("[GET merchant/widget]", err);
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

  const settings =
    body.settings !== undefined
      ? normalizeWidgetSettings(body.settings)
      : undefined;

  try {
    const dto = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        updateMerchantWidget(client, auth.activeOrganizationId!, auth.userId, {
          widgetEnabled:
            body.widgetEnabled === undefined
              ? undefined
              : Boolean(body.widgetEnabled),
          buttonLabel:
            body.buttonLabel === undefined
              ? undefined
              : String(body.buttonLabel),
          customerGroupIds,
          settings: settings as WidgetSettingsPayload | undefined,
        }),
    );
    return NextResponse.json({ ok: true, widget: dto });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NO_SHOP") {
      return NextResponse.json({ error: "Nincs shop" }, { status: 404 });
    }
    console.error("[PATCH merchant/widget]", err);
    return NextResponse.json({ error: "Mentés sikertelen" }, { status: 500 });
  }
}
