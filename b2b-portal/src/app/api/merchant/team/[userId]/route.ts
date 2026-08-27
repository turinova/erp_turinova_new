import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireOrgAdminApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { removeTeamMember, updateTeamMember } from "@/lib/merchant/team";

type Ctx = { params: Promise<{ userId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireOrgAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;
  let body: { displayName?: string | null; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        updateTeamMember(client, {
          organizationId: auth.activeOrganizationId!,
          actorUserId: auth.userId,
          targetUserId: userId,
          displayName: body.displayName,
          password: body.password,
        }),
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true, member: result.member });
  } catch (err) {
    console.error("[PATCH merchant/team/:userId]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireOrgAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { userId } = await ctx.params;

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        removeTeamMember(client, {
          organizationId: auth.activeOrganizationId!,
          actorUserId: auth.userId,
          targetUserId: userId,
        }),
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE merchant/team/:userId]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
