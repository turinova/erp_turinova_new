import { NextResponse } from "next/server";
import {
  appStorePlanId,
  isAppStoreBillingEnabled,
} from "@/lib/billing/embed-pricing";
import {
  applyBillingStatusToOrg,
  setOrgBillingState,
} from "@/lib/billing/org-billing";
import { trialDaysLeft } from "@/lib/orgs/health";
import { query, withPlatformAdmin } from "@/lib/db";
import { publicAppUrl } from "@/lib/public-app-url";
import { createRecurringCharge } from "@/lib/shoprenter/billing/recurring";
import { getEmbedSessionFromCookies } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";
import { loadShopConfigByShopId } from "@/lib/shoprenter/install/shop-script-state";
import { headers } from "next/headers";

/**
 * POST /api/shoprenter/embed/subscribe
 * Body: { annual?: boolean }
 * Creates Shoprenter recurring charge when SR_BILLING_ENABLED=1, else mailto hint.
 */
export async function POST(req: Request) {
  const session = await getEmbedSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Nincs session" }, { status: 401 });
  }

  let annual = false;
  try {
    const body = (await req.json()) as { annual?: boolean };
    annual = Boolean(body.annual);
  } catch {
    /* empty body ok */
  }

  const shop = await findEmbedShopById(session.shopId);
  if (!shop) {
    return NextResponse.json({ error: "Bolt nem található" }, { status: 404 });
  }

  if (!isAppStoreBillingEnabled()) {
    return NextResponse.json({
      ok: true,
      mode: "mailto" as const,
      message: "A Payment API még nincs bekapcsolva. Használd az e-mailes előfizetést.",
    });
  }

  const planId = appStorePlanId(annual);
  if (!planId) {
    return NextResponse.json(
      { error: "Hiányzik a plan ID (SR_PLAN_ID_MONTHLY / ANNUAL)" },
      { status: 500 },
    );
  }

  const loaded = await loadShopConfigByShopId(shop.shopId);
  if (!loaded) {
    return NextResponse.json(
      { error: "Nincs Shoprenter API kulcs a bolthoz" },
      { status: 400 },
    );
  }

  const h = await headers();
  const base = publicAppUrl(h);
  const remainingTrial =
    shop.orgStatus === "trial" && shop.trialEndsAt
      ? Math.max(0, trialDaysLeft(shop.trialEndsAt) ?? 0)
      : 0;

  const test = (process.env.SR_BILLING_TEST || "").trim() === "1";
  const created = await createRecurringCharge(loaded.config, {
    planId,
    trialDays: remainingTrial,
    test,
    notificationUrl: `${base}/api/shoprenter/billing/webhook`,
    successUrl: `${base}/sr-embed/szamlazas?ok=1`,
    failedUrl: `${base}/sr-embed/szamlazas?ok=0`,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 502 });
  }

  const chargeId = String(created.charge.id);
  const status = String(created.charge.status || "pending");
  const interval = annual ? "annual" : "monthly";

  await withPlatformAdmin(async (client) => {
    const orgRes = await query<{ organization_id: string }>(
      client,
      `select organization_id from shops where id = $1 limit 1`,
      [shop.shopId],
    );
    const orgId = orgRes.rows[0]?.organization_id;
    if (!orgId) return;
    await setOrgBillingState(client, orgId, {
      chargeId,
      status,
      interval,
    });
    if (status === "active") {
      await applyBillingStatusToOrg(client, orgId, "active");
    }
  });

  const confirmationUrl = created.charge.confirmationUrl;
  return NextResponse.json({
    ok: true,
    mode: "payment_api" as const,
    chargeId,
    status,
    confirmationUrl: confirmationUrl || null,
  });
}
