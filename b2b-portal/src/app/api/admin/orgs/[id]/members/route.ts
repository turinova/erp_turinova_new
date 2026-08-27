import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { withPlatformAdmin } from "@/lib/db";
import {
  createTeamMember,
  listTeamMembers,
} from "@/lib/merchant/team";
import { getOrganizationDetail } from "@/lib/orgs/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  try {
    const team = await withPlatformAdmin((client) =>
      listTeamMembers(client, id),
    );
    return NextResponse.json({ ok: true, ...team });
  } catch (err) {
    console.error("[GET admin/orgs/:id/members]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  let body: {
    email?: string;
    displayName?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin(async (client) => {
      const created = await createTeamMember(client, {
        organizationId: id,
        actorUserId: auth.userId,
        email: body.email ?? "",
        displayName: body.displayName,
        password: body.password,
      });
      if (!created.ok) return created;
      const organization = await getOrganizationDetail(client, id);
      return { ...created, organization };
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
      created: result.created,
      reusedAccount: result.reusedAccount,
      organization: result.organization,
    });
  } catch (err) {
    console.error("[POST admin/orgs/:id/members]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
