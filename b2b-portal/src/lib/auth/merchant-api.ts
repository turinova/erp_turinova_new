import { NextResponse } from "next/server";
import { isOrgAdminRole } from "@/lib/auth/roles";
import { getSessionFromCookies, type AuthSession } from "@/lib/auth/session";

export async function requireMerchantApi(): Promise<
  AuthSession | NextResponse
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Bejelentkezés szükséges" }, { status: 401 });
  }
  if (!session.activeOrganizationId) {
    if (session.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Platform adminnak nincs aktív szervezete ehhez" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Nincs szervezet tagság" },
      { status: 403 },
    );
  }
  // Real merchant users must still be members of the active org.
  if (!session.isPlatformAdmin && !session.orgRole) {
    return NextResponse.json(
      { error: "Nincs szervezet tagság" },
      { status: 403 },
    );
  }
  if (!session.isPlatformAdmin && session.orgStatus === "suspended") {
    return NextResponse.json(
      {
        error: "A fiók fel van függesztve",
        code: "suspended",
      },
      { status: 403 },
    );
  }
  return session;
}

/** Admin (owner) only — Settings + team. Blocks platform impersonation writes. */
export async function requireOrgAdminApi(): Promise<
  AuthSession | NextResponse
> {
  const auth = await requireMerchantApi();
  if (auth instanceof NextResponse) return auth;

  if (auth.isPlatformAdmin) {
    return NextResponse.json(
      { error: "Impersonate közben ez a művelet nem elérhető" },
      { status: 403 },
    );
  }
  if (!isOrgAdminRole(auth.orgRole)) {
    return NextResponse.json(
      { error: "Csak az admin fér ehhez hozzá" },
      { status: 403 },
    );
  }
  return auth;
}

/**
 * Settings writes (shop credentials, ping, catalog).
 * Org admin OR platform impersonation; Users blocked.
 */
export async function requireSettingsAdminApi(): Promise<
  AuthSession | NextResponse
> {
  const auth = await requireMerchantApi();
  if (auth instanceof NextResponse) return auth;

  if (auth.isPlatformAdmin) return auth;
  if (!isOrgAdminRole(auth.orgRole)) {
    return NextResponse.json(
      { error: "Csak az admin fér ehhez hozzá" },
      { status: 403 },
    );
  }
  return auth;
}

export function isErrorResponse(
  v: AuthSession | NextResponse,
): v is NextResponse {
  return v instanceof NextResponse;
}
