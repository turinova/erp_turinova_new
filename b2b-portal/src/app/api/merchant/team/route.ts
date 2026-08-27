import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireOrgAdminApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { createTeamMember, listTeamMembers } from "@/lib/merchant/team";

export async function GET() {
  const auth = await requireOrgAdminApi();
  if (isErrorResponse(auth)) return auth;

  try {
    const team = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) => listTeamMembers(client, auth.activeOrganizationId!),
    );
    return NextResponse.json({ ok: true, ...team });
  } catch (err) {
    console.error("[GET merchant/team]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireOrgAdminApi();
  if (isErrorResponse(auth)) return auth;

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
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      (client) =>
        createTeamMember(client, {
          organizationId: auth.activeOrganizationId!,
          actorUserId: auth.userId,
          email: body.email ?? "",
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
    return NextResponse.json({
      ok: true,
      member: result.member,
      created: result.created,
      reusedAccount: result.reusedAccount,
    });
  } catch (err) {
    console.error("[POST merchant/team]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
