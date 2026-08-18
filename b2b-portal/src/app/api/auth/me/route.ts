import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
      isPlatformAdmin: session.isPlatformAdmin,
      activeOrganizationId: session.activeOrganizationId,
    },
  });
}
