import type { PoolClient } from "pg";
import { hashPassword } from "@/lib/auth/password";
import { isOrgAdminRole, roleLabelHu } from "@/lib/auth/roles";
import { findUserByEmail, revokeUserSessions } from "@/lib/auth/session";
import { insertAudit } from "@/lib/orgs/ops";
import { query } from "@/lib/db";
import type { MembershipRole } from "@/types/db";

export const MAX_ORG_MEMBERS = 20;

export type TeamMemberDto = {
  userId: string;
  email: string;
  displayName: string | null;
  role: MembershipRole;
  roleLabel: string;
  lastLoginAt: string | null;
  disabledAt: string | null;
  createdAt: string;
};

export type TeamListResult = {
  members: TeamMemberDto[];
  count: number;
  limit: number;
};

type TeamError = { ok: false; error: string; status: number };
type TeamOk<T> = { ok: true } & T;

async function assertOrgWritable(
  client: PoolClient,
  organizationId: string,
): Promise<TeamError | null> {
  const res = await query<{ status: string }>(
    client,
    `select status from organizations where id = $1`,
    [organizationId],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, error: "Szervezet nem található", status: 404 };
  if (row.status === "suspended") {
    return {
      ok: false,
      error: "A szervezet fel van függesztve",
      status: 403,
    };
  }
  return null;
}

export async function listTeamMembers(
  client: PoolClient,
  organizationId: string,
): Promise<TeamListResult> {
  const res = await query<{
    user_id: string;
    email: string;
    display_name: string | null;
    role: MembershipRole;
    last_login_at: string | null;
    disabled_at: string | null;
    created_at: string;
  }>(
    client,
    `select
       u.id as user_id,
       u.email,
       u.display_name,
       m.role,
       u.last_login_at,
       u.disabled_at,
       m.created_at
     from memberships m
     join users u on u.id = m.user_id
     where m.organization_id = $1
     order by
       case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
       m.created_at`,
    [organizationId],
  );

  const members: TeamMemberDto[] = res.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    roleLabel: roleLabelHu(r.role),
    lastLoginAt: r.last_login_at,
    disabledAt: r.disabled_at,
    createdAt: r.created_at,
  }));

  return {
    members,
    count: members.length,
    limit: MAX_ORG_MEMBERS,
  };
}

export async function createTeamMember(
  client: PoolClient,
  opts: {
    organizationId: string;
    actorUserId: string;
    email: string;
    displayName?: string | null;
    password?: string | null;
  },
): Promise<
  TeamOk<{
    member: TeamMemberDto;
    created: boolean;
    reusedAccount: boolean;
  }> | TeamError
> {
  const blocked = await assertOrgWritable(client, opts.organizationId);
  if (blocked) return blocked;

  const email = opts.email.toLowerCase().trim();
  const displayName = opts.displayName?.trim() || null;
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Érvényes email kell", status: 400 };
  }

  const countRes = await query<{ n: string }>(
    client,
    `select count(*)::text as n from memberships where organization_id = $1`,
    [opts.organizationId],
  );
  const count = Number(countRes.rows[0]?.n ?? 0);
  if (count >= MAX_ORG_MEMBERS) {
    return {
      ok: false,
      error: `Maximum ${MAX_ORG_MEMBERS} felhasználó lehet`,
      status: 400,
    };
  }

  let user = await findUserByEmail(client, email);
  let created = false;
  let reusedAccount = false;

  if (user) {
    if (user.is_platform_admin) {
      return {
        ok: false,
        error: "Ez az email platform adminhoz tartozik",
        status: 400,
      };
    }
    if (user.disabled_at) {
      return {
        ok: false,
        error: "Ez a fiók le van tiltva. Írj a supportnak.",
        status: 400,
      };
    }
    const existing = await query<{ id: string }>(
      client,
      `select id from memberships
       where organization_id = $1 and user_id = $2`,
      [opts.organizationId, user.id],
    );
    if (existing.rows[0]) {
      return { ok: false, error: "Már felhasználó ebben a szervezetben", status: 400 };
    }
    reusedAccount = true;
    await query(
      client,
      `insert into memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [opts.organizationId, user.id],
    );
  } else {
    const password = opts.password ?? "";
    if (password.length < 8) {
      return {
        ok: false,
        error: "Legalább 8 karakteres jelszó kell",
        status: 400,
      };
    }
    const passwordHash = await hashPassword(password);
    const createdUser = await query<{ id: string }>(
      client,
      `insert into users (email, password_hash, display_name)
       values ($1, $2, $3)
       returning id`,
      [email, passwordHash, displayName],
    );
    user = {
      id: createdUser.rows[0].id,
      email,
      password_hash: passwordHash,
      display_name: displayName,
      is_platform_admin: false,
      last_login_at: null,
      disabled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    created = true;
    await query(
      client,
      `insert into memberships (organization_id, user_id, role)
       values ($1, $2, 'member')`,
      [opts.organizationId, user.id],
    );
  }

  await insertAudit(client, {
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    action: "team.created",
    meta: {
      user_id: user.id,
      email,
      created,
      reusedAccount,
    },
  });

  const list = await listTeamMembers(client, opts.organizationId);
  const member = list.members.find((m) => m.userId === user!.id);
  if (!member) {
    return { ok: false, error: "Létrehozás után nem található", status: 500 };
  }

  return { ok: true, member, created, reusedAccount };
}

export async function updateTeamMember(
  client: PoolClient,
  opts: {
    organizationId: string;
    actorUserId: string;
    targetUserId: string;
    displayName?: string | null;
    password?: string | null;
    /** Platform-only fields */
    email?: string | null;
    disabled?: boolean | null;
    allowAdminTarget?: boolean;
  },
): Promise<TeamOk<{ member: TeamMemberDto }> | TeamError> {
  const blocked = await assertOrgWritable(client, opts.organizationId);
  if (blocked) return blocked;

  const mem = await query<{
    user_id: string;
    role: MembershipRole;
    email: string;
    display_name: string | null;
    disabled_at: string | null;
  }>(
    client,
    `select m.user_id, m.role, u.email, u.display_name, u.disabled_at
     from memberships m
     join users u on u.id = m.user_id
     where m.organization_id = $1 and m.user_id = $2`,
    [opts.organizationId, opts.targetUserId],
  );
  const row = mem.rows[0];
  if (!row) {
    return { ok: false, error: "Felhasználó nem található", status: 404 };
  }

  const targetingAdmin = isOrgAdminRole(row.role);
  if (targetingAdmin && !opts.allowAdminTarget) {
    // Merchant admin may reset own password/name only.
    if (opts.actorUserId !== opts.targetUserId) {
      return {
        ok: false,
        error: "Az admin fiókot csak a platform szerkesztheti",
        status: 403,
      };
    }
    if (opts.email != null || opts.disabled != null) {
      return {
        ok: false,
        error: "Az admin emailjét / tiltását csak a platform módosíthatja",
        status: 403,
      };
    }
  }

  if (opts.email != null) {
    const nextEmail = opts.email.toLowerCase().trim();
    if (!nextEmail.includes("@")) {
      return { ok: false, error: "Érvényes email kell", status: 400 };
    }
    if (nextEmail !== row.email) {
      const clash = await findUserByEmail(client, nextEmail);
      if (clash && clash.id !== opts.targetUserId) {
        return { ok: false, error: "Ez az email már foglalt", status: 400 };
      }
      await query(
        client,
        `update users set email = $1, updated_at = now() where id = $2`,
        [nextEmail, opts.targetUserId],
      );
    }
  }

  if (opts.displayName !== undefined) {
    const name = opts.displayName?.trim() || null;
    await query(
      client,
      `update users set display_name = $1, updated_at = now() where id = $2`,
      [name, opts.targetUserId],
    );
  }

  if (opts.password != null && opts.password.length > 0) {
    if (opts.password.length < 8) {
      return {
        ok: false,
        error: "Legalább 8 karakteres jelszó kell",
        status: 400,
      };
    }
    const passwordHash = await hashPassword(opts.password);
    await query(
      client,
      `update users set password_hash = $1, updated_at = now() where id = $2`,
      [passwordHash, opts.targetUserId],
    );
    await revokeUserSessions(client, opts.targetUserId);
    await insertAudit(client, {
      organizationId: opts.organizationId,
      actorUserId: opts.actorUserId,
      action: "user.password_reset",
      meta: { user_id: opts.targetUserId },
    });
  }

  if (opts.disabled === true) {
    await query(
      client,
      `update users set disabled_at = now(), updated_at = now() where id = $1`,
      [opts.targetUserId],
    );
    await revokeUserSessions(client, opts.targetUserId);
    await insertAudit(client, {
      organizationId: opts.organizationId,
      actorUserId: opts.actorUserId,
      action: "user.disabled",
      meta: { user_id: opts.targetUserId },
    });
  } else if (opts.disabled === false) {
    await query(
      client,
      `update users set disabled_at = null, updated_at = now() where id = $1`,
      [opts.targetUserId],
    );
    await insertAudit(client, {
      organizationId: opts.organizationId,
      actorUserId: opts.actorUserId,
      action: "user.enabled",
      meta: { user_id: opts.targetUserId },
    });
  }

  if (
    opts.displayName !== undefined ||
    (opts.email != null && opts.email.toLowerCase().trim() !== row.email)
  ) {
    await insertAudit(client, {
      organizationId: opts.organizationId,
      actorUserId: opts.actorUserId,
      action: "team.updated",
      meta: { user_id: opts.targetUserId },
    });
  }

  const list = await listTeamMembers(client, opts.organizationId);
  const member = list.members.find((m) => m.userId === opts.targetUserId);
  if (!member) {
    return { ok: false, error: "Felhasználó nem található", status: 404 };
  }
  return { ok: true, member };
}

export async function removeTeamMember(
  client: PoolClient,
  opts: {
    organizationId: string;
    actorUserId: string;
    targetUserId: string;
    allowAdminTarget?: boolean;
  },
): Promise<TeamOk<{ removed: true }> | TeamError> {
  const blocked = await assertOrgWritable(client, opts.organizationId);
  if (blocked) return blocked;

  const mem = await query<{ role: MembershipRole }>(
    client,
    `select role from memberships
     where organization_id = $1 and user_id = $2`,
    [opts.organizationId, opts.targetUserId],
  );
  const row = mem.rows[0];
  if (!row) {
    return { ok: false, error: "Felhasználó nem található", status: 404 };
  }

  if (isOrgAdminRole(row.role)) {
    if (!opts.allowAdminTarget) {
      return { ok: false, error: "Az admin nem távolítható el innen", status: 400 };
    }
    const owners = await query<{ n: string }>(
      client,
      `select count(*)::text as n from memberships
       where organization_id = $1 and role in ('owner', 'admin')`,
      [opts.organizationId],
    );
    if (Number(owners.rows[0]?.n ?? 0) <= 1) {
      return {
        ok: false,
        error: "Az utolsó admin nem távolítható el",
        status: 400,
      };
    }
  }

  if (opts.actorUserId === opts.targetUserId) {
    return { ok: false, error: "Saját magadat nem törölheted", status: 400 };
  }

  await query(
    client,
    `delete from memberships where organization_id = $1 and user_id = $2`,
    [opts.organizationId, opts.targetUserId],
  );
  await revokeUserSessions(client, opts.targetUserId, {
    organizationId: opts.organizationId,
  });
  await insertAudit(client, {
    organizationId: opts.organizationId,
    actorUserId: opts.actorUserId,
    action: "team.removed",
    meta: { user_id: opts.targetUserId },
  });

  return { ok: true, removed: true };
}
