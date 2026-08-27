import { redirect } from "next/navigation";
import { isOrgAdminRole } from "@/lib/auth/roles";
import {
  clearSessionCookie,
  getSessionFromCookies,
  revokeSession,
  type AuthSession,
} from "@/lib/auth/session";

export async function requireSession(): Promise<AuthSession> {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requirePlatformAdmin(): Promise<AuthSession> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    redirect("/home");
  }
  return session;
}

export async function requireMerchant(): Promise<AuthSession> {
  const session = await requireSession();
  if (session.isPlatformAdmin) {
    if (!session.activeOrganizationId) {
      redirect("/admin");
    }
    // Platform impersonation may still open a suspended org (support).
    return session;
  }
  if (!session.activeOrganizationId || !session.orgRole) {
    redirect("/login");
  }
  if (session.orgStatus === "suspended") {
    try {
      await revokeSession(session.sessionId);
    } catch {
      /* ignore */
    }
    await clearSessionCookie();
    redirect("/login?reason=suspended");
  }
  return session;
}

/** Settings page: Admin or platform impersonation. Users → /home. */
export async function requireOrgAdminPage(): Promise<AuthSession> {
  const session = await requireMerchant();
  if (session.isPlatformAdmin) return session;
  if (!isOrgAdminRole(session.orgRole)) {
    redirect("/home");
  }
  return session;
}

/** Logged-in users hitting /login → send to the right shell */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session) return;
  if (
    !session.isPlatformAdmin &&
    session.orgStatus === "suspended"
  ) {
    try {
      await revokeSession(session.sessionId);
    } catch {
      /* ignore */
    }
    await clearSessionCookie();
    return;
  }
  if (session.isPlatformAdmin) {
    redirect("/admin");
  }
  redirect("/home");
}
