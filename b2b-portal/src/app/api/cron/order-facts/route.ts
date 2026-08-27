import { NextResponse } from "next/server";
import { processOrderFactsSyncTick } from "@/lib/commerce/order-facts-sync";

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
 * Order-facts sync tick (Shoprenter → shop_order_facts).
 * Vercel Cron: Authorization Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processOrderFactsSyncTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/order-facts]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "order-facts cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
