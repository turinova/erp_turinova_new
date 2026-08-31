import { NextResponse } from "next/server";
import { processCustomerGroupsSyncBatch } from "@/lib/merchant/customer-group-sync";

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
 * Soft-sync Shoprenter vevőcsoportok → shop_customer_group_map.
 * Vercel Cron: Authorization Bearer CRON_SECRET
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processCustomerGroupsSyncBatch(8);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/customer-groups]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "customer-groups cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
