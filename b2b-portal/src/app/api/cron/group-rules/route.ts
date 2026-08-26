import { NextResponse } from "next/server";
import { processGroupRulesAutoBatch } from "@/lib/merchant/group-rules-auto";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret");
  return header === secret;
}

/**
 * Daily (or on-demand) cross-tenant group-rules evaluation.
 * Vercel Cron: Authorization Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processGroupRulesAutoBatch(25);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/group-rules]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "group-rules cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
