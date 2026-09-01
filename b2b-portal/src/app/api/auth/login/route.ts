import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  findUserByEmail,
  getPrimaryMembershipOrgId,
  setSessionCookie,
  touchLastLogin,
} from "@/lib/auth/session";
import { withPlatformAdmin, query } from "@/lib/db";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email és jelszó kötelező" },
      { status: 400 },
    );
  }

  try {
    const result = await withPlatformAdmin(async (client) => {
      const user = await findUserByEmail(client, email);
      if (!user || !user.password_hash || user.disabled_at) {
        return { ok: false as const, status: 401 as const };
      }
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return { ok: false as const, status: 401 as const };
      }

      const orgId = user.is_platform_admin
        ? null
        : await getPrimaryMembershipOrgId(client, user.id);

      if (!user.is_platform_admin && !orgId) {
        return { ok: false as const, status: 403 as const, code: "no_org" };
      }

      if (orgId) {
        const org = await query<{ status: string }>(
          client,
          `select status from organizations where id = $1`,
          [orgId],
        );
        if (org.rows[0]?.status === "suspended") {
          return {
            ok: false as const,
            status: 403 as const,
            code: "suspended" as const,
          };
        }
      }

      const ua = req.headers.get("user-agent");
      const { sessionId, expiresAt } = await createSession(client, {
        userId: user.id,
        activeOrganizationId: orgId,
        userAgent: ua,
      });
      await touchLastLogin(client, user.id);
      await query(
        client,
        `insert into audit_events (organization_id, actor_user_id, action, meta)
         values ($1, $2, 'auth.login', $3::jsonb)`,
        [
          orgId,
          user.id,
          JSON.stringify({ email: user.email }),
        ],
      );

      return {
        ok: true as const,
        sessionId,
        expiresAt,
        isPlatformAdmin: user.is_platform_admin,
      };
    });

    if (!result.ok) {
      if ("code" in result && result.code === "no_org") {
        return NextResponse.json(
          { error: "Nincs szervezet tagság. Kérj meghívót." },
          { status: 403 },
        );
      }
      if ("code" in result && result.code === "suspended") {
        return NextResponse.json(
          {
            error:
              "A fiók fel van függesztve. Írj a info@turinova.hu címre, ha szerinted ez hiba.",
            code: "suspended",
          },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: "Hibás email vagy jelszó" },
        { status: 401 },
      );
    }

    await setSessionCookie(result.sessionId, result.expiresAt);
    return NextResponse.json({
      ok: true,
      redirectTo: result.isPlatformAdmin ? "/admin" : "/home",
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Bejelentkezés sikertelen" },
      { status: 500 },
    );
  }
}
