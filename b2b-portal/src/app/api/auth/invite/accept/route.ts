import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import {
  createSession,
  findUserByEmail,
  setSessionCookie,
  touchLastLogin,
} from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { withPlatformAdmin, query } from "@/lib/db";

export async function POST(req: Request) {
  let body: { token?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() || null;

  if (!token || password.length < 8) {
    return NextResponse.json(
      { error: "Token és legalább 8 karakteres jelszó kell" },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(token);

  try {
    const result = await withPlatformAdmin(async (client) => {
      const inv = await query<{
        id: string;
        email: string;
        role: string;
        status: string;
        expires_at: string;
        organization_id: string;
      }>(
        client,
        `select id, email, role, status, expires_at, organization_id
         from invitations where token_hash = $1 limit 1`,
        [tokenHash],
      );
      const invite = inv.rows[0];
      if (!invite || invite.status !== "pending") {
        return { ok: false as const, error: "Érvénytelen meghívó" };
      }
      if (new Date(invite.expires_at) <= new Date()) {
        await query(
          client,
          `update invitations set status = 'expired' where id = $1`,
          [invite.id],
        );
        return { ok: false as const, error: "A meghívó lejárt" };
      }

      let user = await findUserByEmail(client, invite.email);
      const passwordHash = await hashPassword(password);

      if (!user) {
        const created = await query<{ id: string }>(
          client,
          `insert into users (email, password_hash, display_name)
           values ($1, $2, $3)
           returning id`,
          [invite.email, passwordHash, displayName],
        );
        user = {
          id: created.rows[0].id,
          email: invite.email,
          password_hash: passwordHash,
          display_name: displayName,
          is_platform_admin: false,
          last_login_at: null,
          disabled_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        await query(
          client,
          `update users set password_hash = $1, display_name = coalesce($2, display_name), updated_at = now()
           where id = $3`,
          [passwordHash, displayName, user.id],
        );
      }

      await query(
        client,
        `insert into memberships (organization_id, user_id, role)
         values ($1, $2, $3)
         on conflict (organization_id, user_id) do update set role = excluded.role`,
        [invite.organization_id, user.id, invite.role],
      );

      await query(
        client,
        `update invitations
         set status = 'accepted', accepted_at = now()
         where id = $1`,
        [invite.id],
      );

      const { sessionId, expiresAt } = await createSession(client, {
        userId: user.id,
        activeOrganizationId: invite.organization_id,
        userAgent: req.headers.get("user-agent"),
      });
      await touchLastLogin(client, user.id);
      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'invite.accepted', $3::jsonb)`,
        [
          invite.organization_id,
          user.id,
          JSON.stringify({ invitation_id: invite.id }),
        ],
      );

      return {
        ok: true as const,
        sessionId,
        expiresAt,
        isPlatformAdmin: false,
      };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await setSessionCookie(result.sessionId, result.expiresAt);
    return NextResponse.json({ ok: true, redirectTo: "/home" });
  } catch (err) {
    console.error("[invite/accept]", err);
    return NextResponse.json({ error: "Sikertelen aktiválás" }, { status: 500 });
  }
}
