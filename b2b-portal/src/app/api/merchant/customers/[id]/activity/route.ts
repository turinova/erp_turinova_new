import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  listCustomerActivities,
  getCustomerFollowUp,
  recordCustomerActivity,
  type ActivityKind,
} from "@/lib/merchant/customer-activities";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { upsertShopCustomer } from "@/lib/merchant/shop-customers";
import { getCustomerByInnerId } from "@/lib/shoprenter/customers";

type Ctx = { params: Promise<{ id: string }> };

const KINDS = new Set<ActivityKind>([
  "done_call",
  "done_email",
  "done_other",
  "note",
]);

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const customerInnerId = Number((await ctx.params).id);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) return { error: "NO_SHOP_OR_CREDS" as const };

        const [activities, followUp] = await Promise.all([
          listCustomerActivities(client, loaded.shopId, customerInnerId),
          getCustomerFollowUp(client, loaded.shopId, customerInnerId),
        ]);

        return {
          activities: activities.map((a) => ({
            id: a.id,
            kind: a.kind,
            note: a.note,
            nextFollowUpAt: a.next_follow_up_at,
            createdAt: a.created_at,
          })),
          followUp,
        };
      },
    );

    if ("error" in result && result.error === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[GET customer activity]", err);
    const msg = err instanceof Error ? err.message : "Betöltés sikertelen";
    // Table missing → soft empty (SQL 012 not run yet)
    if (/shop_customer_activities|next_follow_up_at/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        activities: [],
        followUp: null,
        needsMigration: true,
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const customerInnerId = Number((await ctx.params).id);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  let body: {
    kind?: string;
    note?: string;
    nextFollowUpAt?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const kind = body.kind as ActivityKind;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Érvénytelen kind" }, { status: 400 });
  }

  let nextFollowUpAt = body.nextFollowUpAt?.trim() || null;
  if (nextFollowUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpAt)) {
    return NextResponse.json(
      { error: "nextFollowUpAt YYYY-MM-DD legyen" },
      { status: 400 },
    );
  }

  try {
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        if (!loaded) throw new Error("NO_SHOP_OR_CREDS");

        const customer = await getCustomerByInnerId(
          loaded.config,
          customerInnerId,
        );
        const name = customer
          ? [customer.lastname, customer.firstname]
              .filter(Boolean)
              .join(" ")
              .trim() || customer.email
          : null;

        const ref = await upsertShopCustomer(client, {
          shopId: loaded.shopId,
          srCustomerInnerId: customerInnerId,
          srCustomerId: customer?.id ?? null,
          email: customer?.email ?? null,
          nameSnapshot: name,
          phoneSnapshot: customer?.telephone ?? null,
          srGroupInnerId: customer?.groupInnerId ?? null,
          srGroupNameSnapshot: customer?.groupName ?? null,
          srStatus: "active",
        });

        const activity = await recordCustomerActivity(client, {
          shopId: loaded.shopId,
          shopCustomerId: ref.id,
          srCustomerInnerId: customerInnerId,
          kind,
          note: body.note?.trim() || null,
          nextFollowUpAt,
          actorUserId: auth.userId,
          orgId: auth.activeOrganizationId!,
        });

        return {
          activity: {
            id: activity.id,
            kind: activity.kind,
            note: activity.note,
            nextFollowUpAt: activity.next_follow_up_at,
            createdAt: activity.created_at,
          },
          message: "Rögzítve.",
        };
      },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    if (/shop_customer_activities|next_follow_up_at/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Futtasd a sql/012_shop_customer_activities.sql migrációt a DB-n.",
        },
        { status: 503 },
      );
    }
    console.error("[POST customer activity]", err);
    return NextResponse.json(
      { error: msg || "Mentés sikertelen" },
      { status: 500 },
    );
  }
}
