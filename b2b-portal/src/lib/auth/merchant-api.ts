import { NextResponse } from "next/server";
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
  return session;
}

export function isErrorResponse(
  v: AuthSession | NextResponse,
): v is NextResponse {
  return v instanceof NextResponse;
}
