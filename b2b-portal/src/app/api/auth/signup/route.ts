import { NextResponse } from "next/server";
import { withPlatformAdmin } from "@/lib/db";
import { startSignup } from "@/lib/auth/signup";

export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    companyName?: string;
    shoprenterShopName?: string;
    storeUrl?: string;
    acceptedLegal?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  if (!body.acceptedLegal) {
    return NextResponse.json(
      { error: "Az ÁSZF és az adatkezelési tájékoztató elfogadása kötelező." },
      { status: 400 },
    );
  }

  try {
    const result = await withPlatformAdmin((client) =>
      startSignup(client, {
        email: body.email ?? "",
        password: body.password ?? "",
        companyName: body.companyName ?? "",
        shoprenterShopName: body.shoprenterShopName ?? "",
        storeUrl: body.storeUrl,
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req.headers.get("x-real-ip"),
        userAgent: req.headers.get("user-agent"),
      }),
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      email: result.email,
      message:
        "Ellenőrző linket küldtünk (helyben a szerver logban / válaszban is megtalálod).",
      verifyUrl: result.verifyUrl,
    });
  } catch (err) {
    console.error("[POST /api/auth/signup]", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("signup_intents") || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Regisztráció tábla hiányzik. Futtasd manuálisan a sql/030_signup_intents.sql fájlt.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Regisztráció sikertelen" }, { status: 500 });
  }
}
