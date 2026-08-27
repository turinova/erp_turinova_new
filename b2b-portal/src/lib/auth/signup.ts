import type { PoolClient } from "pg";
import { hashPassword } from "@/lib/auth/password";
import {
  createSession,
  findUserByEmail,
  touchLastLogin,
} from "@/lib/auth/session";
import {
  generateToken,
  hashToken,
  inviteExpiresAt,
} from "@/lib/auth/tokens";
import { TRIAL_DAYS_DEFAULT } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import { insertAudit } from "@/lib/orgs/ops";
import {
  ensureSlug,
  normalizeStoreUrl,
  originFromStoreUrl,
} from "@/lib/orgs/slug";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
]);

export const SIGNUP_INTENT_TTL_HOURS = 48;
/** After trial ends, keep abandoned orgs this many days before purge. */
export const TRIAL_PURGE_GRACE_DAYS = 14;

export type SignupStartInput = {
  email: string;
  password: string;
  companyName: string;
  shoprenterShopName: string;
  storeUrl?: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type SignupStartResult =
  | {
      ok: true;
      intentId: string;
      email: string;
      /** Only returned in non-production / explicit flag — for local testing. */
      verifyUrl?: string;
    }
  | { ok: false; error: string; status: number };

export type SignupVerifyResult =
  | {
      ok: true;
      organizationId: string;
      sessionId: string;
      expiresAt: Date;
    }
  | { ok: false; error: string; status: number };

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3030"
  );
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

export function shouldReturnVerifyUrl(): boolean {
  if (process.env.SIGNUP_RETURN_VERIFY_URL === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export async function startSignup(
  client: PoolClient,
  input: SignupStartInput,
): Promise<SignupStartResult> {
  const email = input.email.toLowerCase().trim();
  const companyName = input.companyName.trim();
  const shopName = input.shoprenterShopName.trim().toLowerCase();
  const password = input.password;
  const storeUrl = normalizeStoreUrl(input.storeUrl);

  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "Érvényes email kell", status: 400 };
  }
  if (isDisposableEmail(email)) {
    return {
      ok: false,
      error: "Ideiglenes email cím nem használható",
      status: 400,
    };
  }
  if (companyName.length < 2) {
    return { ok: false, error: "Cégnév kötelező", status: 400 };
  }
  if (!shopName || !/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(shopName)) {
    return {
      ok: false,
      error:
        "Érvénytelen Shoprenter shop name (betű, szám, -, _; pl. vasalatmester)",
      status: 400,
    };
  }
  if (password.length < 8) {
    return {
      ok: false,
      error: "Legalább 8 karakteres jelszó kell",
      status: 400,
    };
  }
  if (input.storeUrl?.trim() && !storeUrl) {
    return { ok: false, error: "Érvénytelen bolt URL", status: 400 };
  }

  const existingUser = await findUserByEmail(client, email);
  if (existingUser) {
    return {
      ok: false,
      error: "Ehhez az emailhez már van fiók. Jelentkezz be.",
      status: 400,
    };
  }

  const shopTaken = await query<{ id: string }>(
    client,
    `select id from shops where lower(shoprenter_shop_name) = $1 limit 1`,
    [shopName],
  );
  if (shopTaken.rows[0]) {
    return {
      ok: false,
      error: "Ez a Shoprenter shop name már foglalt",
      status: 400,
    };
  }

  const recent = await query<{ n: string }>(
    client,
    `select count(*)::text as n from signup_intents
     where email = $1 and created_at > now() - interval '1 hour'`,
    [email],
  );
  if (Number(recent.rows[0]?.n ?? 0) >= 5) {
    return {
      ok: false,
      error: "Túl sok próbálkozás. Várj egy órát.",
      status: 429,
    };
  }

  await query(
    client,
    `update signup_intents
     set status = 'revoked'
     where email = $1 and status = 'pending'`,
    [email],
  );
  await query(
    client,
    `update signup_intents
     set status = 'revoked'
     where shoprenter_shop_name = $1 and status = 'pending'`,
    [shopName],
  );

  const passwordHash = await hashPassword(password);
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = inviteExpiresAt(SIGNUP_INTENT_TTL_HOURS / 24);

  const ins = await query<{ id: string }>(
    client,
    `insert into signup_intents (
       email, company_name, shoprenter_shop_name, store_url,
       password_hash, token_hash, status, expires_at, ip, user_agent
     ) values ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9)
     returning id`,
    [
      email,
      companyName,
      shopName,
      storeUrl,
      passwordHash,
      tokenHash,
      expiresAt.toISOString(),
      input.ip ?? null,
      input.userAgent ?? null,
    ],
  );

  const verifyUrl = `${appBaseUrl()}/signup/verify?token=${rawToken}`;
  console.info("[signup] verify link for", email, verifyUrl);

  return {
    ok: true,
    intentId: ins.rows[0].id,
    email,
    verifyUrl: shouldReturnVerifyUrl() ? verifyUrl : undefined,
  };
}

export async function verifyAndProvisionSignup(
  client: PoolClient,
  rawToken: string,
  opts?: { userAgent?: string | null },
): Promise<SignupVerifyResult> {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false, error: "Hiányzó token", status: 400 };
  }
  const tokenHash = hashToken(token);

  const intentRes = await query<{
    id: string;
    email: string;
    company_name: string;
    shoprenter_shop_name: string;
    store_url: string | null;
    password_hash: string;
    status: string;
    expires_at: string;
  }>(
    client,
    `select id, email, company_name, shoprenter_shop_name, store_url,
            password_hash, status, expires_at
     from signup_intents
     where token_hash = $1
     limit 1`,
    [tokenHash],
  );
  const intent = intentRes.rows[0];
  if (!intent || intent.status !== "pending") {
    return { ok: false, error: "Érvénytelen vagy felhasznált link", status: 400 };
  }
  if (new Date(intent.expires_at) <= new Date()) {
    await query(
      client,
      `update signup_intents set status = 'expired' where id = $1`,
      [intent.id],
    );
    return { ok: false, error: "A link lejárt. Regisztrálj újra.", status: 400 };
  }

  const existingUser = await findUserByEmail(client, intent.email);
  if (existingUser) {
    await query(
      client,
      `update signup_intents set status = 'revoked' where id = $1`,
      [intent.id],
    );
    return {
      ok: false,
      error: "Ehhez az emailhez már van fiók. Jelentkezz be.",
      status: 400,
    };
  }

  const shopTaken = await query<{ id: string }>(
    client,
    `select id from shops where lower(shoprenter_shop_name) = $1 limit 1`,
    [intent.shoprenter_shop_name],
  );
  if (shopTaken.rows[0]) {
    return {
      ok: false,
      error: "Ez a Shoprenter shop name már foglalt",
      status: 400,
    };
  }

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS_DEFAULT);
  const slug = ensureSlug(intent.company_name);

  let finalSlug = slug;
  for (let i = 0; i < 8; i++) {
    const clash = await query<{ id: string }>(
      client,
      `select id from organizations where slug = $1 limit 1`,
      [finalSlug],
    );
    if (!clash.rows[0]) break;
    finalSlug = `${slug}-${i + 2}`;
  }

  const orgIns = await query<{ id: string }>(
    client,
    `insert into organizations (
       name, slug, status, plan, trial_ends_at, signup_source, purge_protected
     ) values ($1, $2, 'trial', 'start', $3, 'self_serve', false)
     returning id`,
    [intent.company_name, finalSlug, trialEnds.toISOString()],
  );
  const orgId = orgIns.rows[0].id;

  const shopIns = await query<{ id: string }>(
    client,
    `insert into shops (
       organization_id, shoprenter_shop_name, store_url, status, widget_enabled
     ) values ($1, $2, $3, 'draft', false)
     returning id`,
    [orgId, intent.shoprenter_shop_name, intent.store_url],
  );
  const shopId = shopIns.rows[0].id;

  await query(client, `insert into widget_settings (shop_id) values ($1)`, [
    shopId,
  ]);

  if (intent.store_url) {
    await query(
      client,
      `insert into shop_allowed_origins (shop_id, origin)
       values ($1, $2)
       on conflict do nothing`,
      [shopId, originFromStoreUrl(intent.store_url)],
    );
  }

  const userIns = await query<{ id: string }>(
    client,
    `insert into users (email, password_hash, display_name)
     values ($1, $2, $3)
     returning id`,
    [intent.email, intent.password_hash, intent.company_name],
  );
  const userId = userIns.rows[0].id;

  await query(
    client,
    `insert into memberships (organization_id, user_id, role)
     values ($1, $2, 'owner')`,
    [orgId, userId],
  );

  await query(
    client,
    `update signup_intents
     set status = 'provisioned',
         provisioned_at = now(),
         provisioned_organization_id = $2
     where id = $1`,
    [intent.id, orgId],
  );

  await insertAudit(client, {
    organizationId: orgId,
    actorUserId: userId,
    action: "org.created",
    meta: {
      source: "self_serve",
      slug: finalSlug,
      shop: intent.shoprenter_shop_name,
    },
  });
  await insertAudit(client, {
    organizationId: orgId,
    actorUserId: userId,
    action: "signup.provisioned",
    meta: { intent_id: intent.id },
  });

  const { sessionId, expiresAt } = await createSession(client, {
    userId,
    activeOrganizationId: orgId,
    userAgent: opts?.userAgent,
  });
  await touchLastLogin(client, userId);

  return { ok: true, organizationId: orgId, sessionId, expiresAt };
}

/**
 * Expire stale intents + delete abandoned self-serve trials.
 * Safe: skips purge_protected, active/paid, or recently logged-in owners.
 */
export async function runSignupMaintenance(
  client: PoolClient,
): Promise<{ expiredIntents: number; purgedOrgs: number }> {
  const expired = await query(
    client,
    `update signup_intents
     set status = 'expired'
     where status = 'pending' and expires_at < now()`,
  );

  const candidates = await query<{
    id: string;
    slug: string;
  }>(
    client,
    `select o.id, o.slug
     from organizations o
     where o.status = 'trial'
       and o.signup_source = 'self_serve'
       and o.purge_protected = false
       and o.trial_ends_at is not null
       and o.trial_ends_at < now() - ($1::text || ' days')::interval
       and not exists (
         select 1 from shops s
         where s.organization_id = o.id
           and s.purged_at is null
           and s.last_ping_ok = true
       )
       and not exists (
         select 1 from memberships m
         join users u on u.id = m.user_id
         where m.organization_id = o.id
           and m.role in ('owner', 'admin')
           and u.last_login_at is not null
           and u.last_login_at > o.trial_ends_at
       )
     limit 25`,
    [String(TRIAL_PURGE_GRACE_DAYS)],
  );

  let purgedOrgs = 0;
  for (const org of candidates.rows) {
    await query(
      client,
      `insert into audit_events (organization_id, actor_user_id, action, meta)
       values ($1, null, 'org.trial_purged', $2::jsonb)`,
      [
        org.id,
        JSON.stringify({ slug: org.slug, reason: "abandoned_self_serve_trial" }),
      ],
    );
    // Cascade: memberships, shops (→ catalog, credentials, …), sessions via user if only org
    const memberUsers = await query<{ user_id: string }>(
      client,
      `select user_id from memberships where organization_id = $1`,
      [org.id],
    );
    await query(client, `delete from organizations where id = $1`, [org.id]);

    for (const m of memberUsers.rows) {
      const other = await query<{ n: string }>(
        client,
        `select count(*)::text as n from memberships where user_id = $1`,
        [m.user_id],
      );
      if (Number(other.rows[0]?.n ?? 0) === 0) {
        await query(
          client,
          `update sessions set revoked_at = now()
           where user_id = $1 and revoked_at is null`,
          [m.user_id],
        );
        await query(client, `delete from users where id = $1 and is_platform_admin = false`, [
          m.user_id,
        ]);
      }
    }
    purgedOrgs += 1;
  }

  return {
    expiredIntents: expired.rowCount ?? 0,
    purgedOrgs,
  };
}
