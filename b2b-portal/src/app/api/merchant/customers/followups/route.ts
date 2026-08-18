import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { query, withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";

/**
 * Követendő partnerek (next_follow_up_at <= ma).
 */
export async function GET() {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

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

        const res = await query<{
          sr_customer_inner_id: number;
          email: string | null;
          name_snapshot: string | null;
          next_follow_up_at: string | null;
          last_activity_kind: string | null;
          last_activity_at: string | null;
        }>(
          client,
          `select sr_customer_inner_id, email, name_snapshot,
                  next_follow_up_at::text,
                  last_activity_kind,
                  last_activity_at::text
           from shop_customers
           where shop_id = $1
             and next_follow_up_at is not null
             and next_follow_up_at <= current_date
           order by next_follow_up_at asc, last_activity_at desc nulls last
           limit 100`,
          [loaded.shopId],
        );

        return {
          customers: res.rows.map((r) => ({
            innerId: r.sr_customer_inner_id,
            email: r.email,
            name: r.name_snapshot || r.email || `#${r.sr_customer_inner_id}`,
            nextFollowUpAt: r.next_follow_up_at,
            lastActivityKind: r.last_activity_kind,
            lastActivityAt: r.last_activity_at,
          })),
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
    const msg = err instanceof Error ? err.message : "";
    if (/next_follow_up_at/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        customers: [],
        needsMigration: true,
      });
    }
    console.error("[GET followups]", err);
    return NextResponse.json(
      { error: msg || "Követések betöltése sikertelen" },
      { status: 500 },
    );
  }
}
