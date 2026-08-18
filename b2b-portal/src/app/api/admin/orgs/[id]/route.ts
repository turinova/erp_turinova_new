import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { kickCatalogSync } from "@/lib/commerce/loop";
import { withPlatformAdmin } from "@/lib/db";
import { isKnownPlanInput, parsePlanId } from "@/lib/billing/plans";
import {
  patchOrganization,
  resumeCatalogAfterOverride,
  type PatchOrgInput,
} from "@/lib/orgs/ops";
import { getOrganizationDetail } from "@/lib/orgs/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  try {
    const detail = await withPlatformAdmin((client) =>
      getOrganizationDetail(client, id),
    );
    if (!detail) {
      return NextResponse.json({ error: "Nem található" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, organization: detail });
  } catch (err) {
    console.error("[GET /api/admin/orgs/:id]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  let body: PatchOrgInput;
  try {
    body = (await req.json()) as PatchOrgInput;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  if (body.plan && !isKnownPlanInput(body.plan)) {
    return NextResponse.json({ error: "Érvénytelen csomag" }, { status: 400 });
  }
  if (body.plan) body.plan = parsePlanId(body.plan);
  if (
    body.extendTrialDays != null &&
    (!Number.isFinite(body.extendTrialDays) ||
      body.extendTrialDays < 1 ||
      body.extendTrialDays > 90)
  ) {
    return NextResponse.json({ error: "A hosszabbítás 1–90 nap" }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin(async (client) => {
      const patched = await patchOrganization(client, id, auth.userId, body);
      if (!patched.ok) return patched;
      if ("skuLimitOverride" in body || "partnerLimitOverride" in body) {
        await resumeCatalogAfterOverride(client, id);
      }
      const organization = await getOrganizationDetail(client, id);
      return { ok: true as const, organization };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if ("skuLimitOverride" in body) kickCatalogSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[PATCH /api/admin/orgs/:id]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
