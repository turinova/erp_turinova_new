import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { withPlatformAdmin, query } from "@/lib/db";
import { sessionExpiresAt } from "@/lib/auth/tokens";
import type { MembershipRole, User } from "@/types/db";

export const SESSION_COOKIE = "b2b_session";

export type AuthSession = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string | null;
  isPlatformAdmin: boolean;
  activeOrganizationId: string | null;
  /** Membership role in activeOrganizationId; null if none / platform-only. */
  orgRole: MembershipRole | null;
  /** organizations.status for active org; null if no org. */
  orgStatus: "trial" | "active" | "suspended" | null;
};

type SessionJoinRow = {
  session_id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  is_platform_admin: boolean;
  active_organization_id: string | null;
  disabled_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  org_role: MembershipRole | null;
  org_status: string | null;
};

export async function createSession(
  client: PoolClient,
  opts: {
    userId: string;
    activeOrganizationId: string | null;
    userAgent?: string | null;
    ip?: string | null;
  },
): Promise<{ sessionId: string; expiresAt: Date }> {
  const expiresAt = sessionExpiresAt(14);
  const res = await query<{ id: string }>(
    client,
    `insert into sessions (user_id, active_organization_id, expires_at, user_agent)
     values ($1, $2, $3, $4)
     returning id`,
    [
      opts.userId,
      opts.activeOrganizationId,
      expiresAt.toISOString(),
      opts.userAgent ?? null,
    ],
  );
  return { sessionId: res.rows[0].id, expiresAt };
}

export async function findSessionById(
  sessionId: string,
): Promise<AuthSession | null> {
  return withPlatformAdmin(async (client) => {
    const res = await query<SessionJoinRow>(
      client,
      `select
         s.id as session_id,
         s.user_id,
         s.active_organization_id,
         s.expires_at,
         s.revoked_at,
         u.email,
         u.display_name,
         u.is_platform_admin,
         u.disabled_at,
         m.role as org_role,
         o.status as org_status
       from sessions s
       join users u on u.id = s.user_id
       left join memberships m
         on m.user_id = s.user_id
        and m.organization_id = s.active_organization_id
       left join organizations o on o.id = s.active_organization_id
       where s.id = $1
       limit 1`,
      [sessionId],
    );
    const row = res.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.disabled_at) return null;
    if (new Date(row.expires_at) <= new Date()) return null;

    const activeOrganizationId = row.active_organization_id;
    let resolvedOrgId = activeOrganizationId;
    let orgRole = row.org_role;
    // Non-admins lose the org pointer if membership was removed.
    if (activeOrganizationId && !orgRole && !row.is_platform_admin) {
      resolvedOrgId = null;
      orgRole = null;
    }

    return {
      sessionId: row.session_id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      isPlatformAdmin: row.is_platform_admin,
      activeOrganizationId: resolvedOrgId,
      orgRole: resolvedOrgId ? orgRole : null,
      orgStatus: resolvedOrgId
        ? ((row.org_status as AuthSession["orgStatus"]) ?? null)
        : null,
    };
  });
}

/** Revoke every session currently pointed at this org (e.g. after suspend). */
export async function revokeSessionsForOrganization(
  client: PoolClient,
  organizationId: string,
): Promise<void> {
  await query(
    client,
    `update sessions
     set revoked_at = now()
     where active_organization_id = $1
       and revoked_at is null`,
    [organizationId],
  );
}

export async function revokeUserSessions(
  client: PoolClient,
  userId: string,
  opts?: { organizationId?: string },
): Promise<void> {
  if (opts?.organizationId) {
    await query(
      client,
      `update sessions
       set revoked_at = now()
       where user_id = $1
         and active_organization_id = $2
         and revoked_at is null`,
      [userId, opts.organizationId],
    );
    return;
  }
  await query(
    client,
    `update sessions set revoked_at = now() where user_id = $1 and revoked_at is null`,
    [userId],
  );
}

export async function revokeSession(sessionId: string): Promise<void> {
  await withPlatformAdmin(async (client) => {
    await query(
      client,
      `update sessions set revoked_at = now() where id = $1 and revoked_at is null`,
      [sessionId],
    );
  });
}

export async function getSessionFromCookies(): Promise<AuthSession | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return findSessionById(id);
}

export async function setSessionCookie(
  sessionId: string,
  expiresAt: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function findUserByEmail(
  client: PoolClient,
  email: string,
): Promise<User | null> {
  const res = await query<User>(
    client,
    `select * from users where email = $1 limit 1`,
    [email.toLowerCase().trim()],
  );
  return res.rows[0] ?? null;
}

export async function touchLastLogin(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await query(client, `update users set last_login_at = now() where id = $1`, [
    userId,
  ]);
}

export async function getPrimaryMembershipOrgId(
  client: PoolClient,
  userId: string,
): Promise<string | null> {
  const res = await query<{ organization_id: string }>(
    client,
    `select organization_id from memberships
     where user_id = $1
     order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, created_at
     limit 1`,
    [userId],
  );
  return res.rows[0]?.organization_id ?? null;
}
