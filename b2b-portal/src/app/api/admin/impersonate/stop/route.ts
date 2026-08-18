import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import { withPlatformAdmin } from "@/lib/db";
import { insertAudit, setSessionOrg } from "@/lib/orgs/ops";

export async function POST() {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  try {
    await withPlatformAdmin(async (client) => {
      const orgId = auth.activeOrganizationId;
      await setSessionOrg(client, auth.sessionId, null);
      if (orgId) {
        await insertAudit(client, {
          organizationId: orgId,
          actorUserId: auth.userId,
          action: "org.impersonate_stopped",
          meta: {},
        });
      }
    });
    return NextResponse.json({ ok: true, redirect: "/admin" });
  } catch (err) {
    console.error("[POST /api/admin/impersonate/stop]", err);
    return NextResponse.json({ error: "Hiba" }, { status: 500 });
  }
}
