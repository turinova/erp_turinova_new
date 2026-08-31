import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  normalizeMarketingProfile,
  type MarketingProfile,
} from "@/lib/merchant/partner-activation";
import {
  loadPartnerActivation,
  saveMarketingProfile,
} from "@/lib/merchant/partner-activation-data";

export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const dto = await withTenant(
      { organizationId: auth.activeOrganizationId!, userId: auth.userId },
      (client) => loadPartnerActivation(client, auth.activeOrganizationId!),
    );
    if (!dto) {
      return NextResponse.json({ error: "Nincs bolt" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, activation: dto });
  } catch (err) {
    console.error("[GET merchant/partner-activation]", err);
    return NextResponse.json({ error: "Betöltés sikertelen" }, { status: 500 });
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

  try {
    const dto = await withTenant(
      { organizationId: auth.activeOrganizationId!, userId: auth.userId },
      async (client) => {
        const current = await loadPartnerActivation(
          client,
          auth.activeOrganizationId!,
        );
        if (!current) return null;

        let profile: MarketingProfile = current.profile;
        if (body.profile !== undefined) {
          profile = normalizeMarketingProfile(body.profile);
        }
        if (body.acknowledgeLaunchEmail === true) {
          profile = {
            ...profile,
            launchEmailAcknowledgedAt: new Date().toISOString(),
          };
        }

        return saveMarketingProfile(
          client,
          auth.activeOrganizationId!,
          profile,
        );
      },
    );

    if (!dto) {
      return NextResponse.json({ error: "Nincs bolt" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, activation: dto });
  } catch (err) {
    console.error("[PATCH merchant/partner-activation]", err);
    return NextResponse.json({ error: "Mentés sikertelen" }, { status: 500 });
  }
}
