import { redirect } from "next/navigation";
import { getSessionFromCookies, type AuthSession } from "@/lib/auth/session";

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
    // Platform may browse merchant in future; for now send to admin
    // Allow if they also have an org — otherwise admin home
    if (!session.activeOrganizationId) {
      redirect("/admin");
    }
  }
  return session;
}

/** Logged-in users hitting /login → send to the right shell */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getSessionFromCookies();
  if (!session) return;
  if (session.isPlatformAdmin) {
    redirect("/admin");
  }
  redirect("/home");
}
