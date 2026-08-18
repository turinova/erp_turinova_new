import { NextResponse } from "next/server";
import { getSessionFromCookies, type AuthSession } from "@/lib/auth/session";

export async function requirePlatformAdminApi(): Promise<
  AuthSession | NextResponse
> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Bejelentkezés szükséges" }, { status: 401 });
  }
  if (!session.isPlatformAdmin) {
    return NextResponse.json({ error: "Nincs jogosultság" }, { status: 403 });
  }
  return session;
}

export function isErrorResponse(
  v: AuthSession | NextResponse,
): v is NextResponse {
  return v instanceof NextResponse;
}
