import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { withPlatformAdmin } from "@/lib/db";
import { removeTeamMember, updateTeamMember } from "@/lib/merchant/team";
import { getOrganizationDetail } from "@/lib/orgs/queries";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id, userId } = await ctx.params;
  let body: {
    displayName?: string | null;
    password?: string;
    email?: string;
    disabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin(async (client) => {
      const updated = await updateTeamMember(client, {
        organizationId: id,
        actorUserId: auth.userId,
        targetUserId: userId,
        displayName: body.displayName,
        password: body.password,
        email: body.email,
        disabled: body.disabled,
        allowAdminTarget: true,
      });
      if (!updated.ok) return updated;
      const organization = await getOrganizationDetail(client, id);
      return { ...updated, organization };
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      member: result.member,
      organization: result.organization,
    });
  } catch (err) {
    console.error("[PATCH admin/orgs/:id/members/:userId]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id, userId } = await ctx.params;

  try {
    const result = await withPlatformAdmin(async (client) => {
      const removed = await removeTeamMember(client, {
        organizationId: id,
        actorUserId: auth.userId,
        targetUserId: userId,
        allowAdminTarget: true,
      });
      if (!removed.ok) return removed;
      const organization = await getOrganizationDetail(client, id);
      return { ...removed, organization };
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json({
      ok: true,
      organization: result.organization,
    });
  } catch (err) {
    console.error("[DELETE admin/orgs/:id/members/:userId]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
