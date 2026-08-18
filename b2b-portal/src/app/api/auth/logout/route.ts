import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getSessionFromCookies,
  revokeSession,
} from "@/lib/auth/session";
import { withPlatformAdmin, query } from "@/lib/db";

export async function POST() {
  const session = await getSessionFromCookies();
  if (session) {
    await revokeSession(session.sessionId);
    await withPlatformAdmin(async (client) => {
      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'auth.logout', '{}'::jsonb)`,
        [session.activeOrganizationId, session.userId],
      );
    }, session.userId);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
