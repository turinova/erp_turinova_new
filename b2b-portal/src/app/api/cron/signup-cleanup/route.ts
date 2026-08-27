import { NextResponse } from "next/server";
import { runSignupMaintenance } from "@/lib/auth/signup";
import { withPlatformAdmin } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret");
  return header === secret;
}

/**
 * Expire pending signup intents + purge abandoned self-serve trials.
 * Vercel Cron: Authorization Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withPlatformAdmin((client) =>
      runSignupMaintenance(client),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/signup-cleanup]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "signup-cleanup cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
