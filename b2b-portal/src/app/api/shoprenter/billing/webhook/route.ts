import { NextResponse } from "next/server";
import { applyBillingStatusToOrg } from "@/lib/billing/org-billing";
import { query, withPlatformAdmin } from "@/lib/db";
import { normalizeBillingStatus } from "@/lib/shoprenter/billing/recurring";

/**
 * Shoprenter Payment API notificationUrl webhook.
 * Payload shape varies; we accept { id, status } or nested charge.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const charge =
    (body.recurringCharge as Record<string, unknown> | undefined) ||
    (body.charge as Record<string, unknown> | undefined) ||
    body;

  const id = charge.id != null ? String(charge.id) : null;
  const statusRaw =
    (charge.status as string | undefined) ||
    (body.status as string | undefined) ||
    null;
  const status = normalizeBillingStatus(statusRaw);

  if (!id || !status) {
    console.warn("[billing webhook] missing id/status", body);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await withPlatformAdmin(async (client) => {
      const res = await query<{ id: string }>(
        client,
        `select id from organizations where sr_recurring_charge_id = $1 limit 1`,
        [id],
      );
      const orgId = res.rows[0]?.id;
      if (!orgId) {
        console.warn("[billing webhook] unknown charge", id);
        return;
      }
      await applyBillingStatusToOrg(client, orgId, status);
    });
  } catch (err) {
    console.error("[billing webhook]", err);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
