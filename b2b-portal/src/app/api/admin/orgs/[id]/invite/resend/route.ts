import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requirePlatformAdminApi,
} from "@/lib/auth/api";
import {
  generateToken,
  hashToken,
  inviteExpiresAt,
} from "@/lib/auth/tokens";
import { withPlatformAdmin, query } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Revoke pending invite(s) for email and create a fresh one; return new link. */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformAdminApi();
  if (isErrorResponse(auth)) return auth;

  const { id: orgId } = await ctx.params;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3030";

  try {
    const result = await withPlatformAdmin(async (client) => {
      const org = await query(
        client,
        `select id from organizations where id = $1`,
        [orgId],
      );
      if ((org.rowCount ?? 0) === 0) {
        return { ok: false as const, status: 404 as const, error: "Nem található" };
      }

      const pending = await query<{ id: string; email: string; role: string }>(
        client,
        `select id, email, role from invitations
         where organization_id = $1 and status = 'pending'
         order by created_at desc limit 1`,
        [orgId],
      );
      const inv = pending.rows[0];
      if (!inv) {
        return {
          ok: false as const,
          status: 400 as const,
          error: "Nincs függő meghívó",
        };
      }

      await query(
        client,
        `update invitations set status = 'revoked' where id = $1`,
        [inv.id],
      );

      const rawToken = generateToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = inviteExpiresAt(7);

      await query(
        client,
        `insert into invitations (
           organization_id, email, role, token_hash, status,
           invited_by_user_id, expires_at
         ) values ($1, $2, $3, $4, 'pending', $5, $6)`,
        [
          orgId,
          inv.email,
          inv.role,
          tokenHash,
          auth.userId,
          expiresAt.toISOString(),
        ],
      );

      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'invite.resent', $3::jsonb)`,
        [orgId, auth.userId, JSON.stringify({ email: inv.email })],
      );

      return {
        ok: true as const,
        inviteUrl: `${appUrl}/invite/${rawToken}`,
        email: inv.email,
      };
    }, auth.userId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      inviteUrl: result.inviteUrl,
      email: result.email,
      emailSent: false,
    });
  } catch (err) {
    console.error("[invite/resend]", err);
    return NextResponse.json({ error: "Sikertelen" }, { status: 500 });
  }
}
