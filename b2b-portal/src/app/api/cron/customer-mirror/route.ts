import { NextResponse } from "next/server";
import { processCustomerMirrorSyncTick } from "@/lib/commerce/customer-mirror-sync";

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
 * Customer mirror sync tick (Shoprenter → shop_customers).
 * Requires sql/039_shop_customers_mirror.sql.
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processCustomerMirrorSyncTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/customer-mirror]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "customer-mirror cron failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}
