import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyAndProvisionSignup } from "@/lib/auth/signup";
import { withPlatformAdmin } from "@/lib/db";

export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "Hiányzó token" }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin((client) =>
      verifyAndProvisionSignup(client, token, {
        userAgent: req.headers.get("user-agent"),
      }),
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    await setSessionCookie(result.sessionId, result.expiresAt);
    return NextResponse.json({
      ok: true,
      redirectTo: "/settings",
    });
  } catch (err) {
    console.error("[POST /api/auth/signup/verify]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("signup_source") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Séma hiányos. Futtasd manuálisan a sql/030_signup_intents.sql fájlt.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Aktiválás sikertelen" },
      { status: 500 },
    );
  }
}
