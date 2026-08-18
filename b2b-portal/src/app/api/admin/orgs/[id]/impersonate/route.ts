import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { withPlatformAdmin, query } from "@/lib/db";
import { insertAudit, setSessionOrg } from "@/lib/orgs/ops";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id } = await ctx.params;
  try {
    const ok = await withPlatformAdmin(async (client) => {
      const org = await query<{ id: string; name: string }>(
        client,
        `select id, name from organizations where id = $1`,
        [id],
      );
      if (!org.rows[0]) return false;
      await setSessionOrg(client, auth.sessionId, id);
      await insertAudit(client, {
        organizationId: id,
        actorUserId: auth.userId,
        action: "org.impersonated",
        meta: { org: org.rows[0].name },
      });
      return true;
    });
    if (!ok) {
      return NextResponse.json({ error: "Nem található" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, redirect: "/home" });
  } catch (err) {
    console.error("[POST /api/admin/orgs/:id/impersonate]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
