import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import {
  listGroupMap,
  loadMerchantShoprenterConfig,
} from "@/lib/merchant/customer-group-map";
import {
  recordGroupMove,
  upsertShopCustomer,
} from "@/lib/merchant/shop-customers";
import {
  getCustomerByInnerId,
  listCustomerGroups,
  updateCustomerGroup,
} from "@/lib/shoprenter/customers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  let body: { toGroupInnerId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const toGroupInnerId = Number(body.toGroupInnerId);
  if (!Number.isFinite(toGroupInnerId)) {
    return NextResponse.json(
      { error: "toGroupInnerId kell" },
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

        const map = await listGroupMap(client, loaded.shopId);
        const target = map.find((m) => m.sr_group_inner_id === toGroupInnerId);
        const srGroups = await listCustomerGroups(loaded.config);
        const srTarget = srGroups.find((g) => g.innerId === toGroupInnerId);
        const groupOuterId = target?.sr_group_id || srTarget?.id;
        const groupName =
          target?.sr_name_snapshot || srTarget?.name || `Csoport ${toGroupInnerId}`;
        if (!groupOuterId) throw new Error("UNKNOWN_GROUP");

        const customer = await getCustomerByInnerId(
          loaded.config,
          customerInnerId,
        );
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

        await updateCustomerGroup(
          loaded.config,
          customer.id,
          groupOuterId,
        );

        const name = [customer.lastname, customer.firstname]
          .filter(Boolean)
          .join(" ")
          .trim();

        const ref = await upsertShopCustomer(client, {
          shopId: loaded.shopId,
          srCustomerInnerId: customer.innerId,
          srCustomerId: customer.id,
          email: customer.email,
          nameSnapshot: name || customer.email,
          phoneSnapshot: customer.telephone,
          srGroupInnerId: toGroupInnerId,
          srGroupNameSnapshot: groupName,
          srStatus: "active",
        });

        await recordGroupMove(client, {
          shopId: loaded.shopId,
          shopCustomerId: ref.id,
          srCustomerInnerId: customer.innerId,
          emailSnapshot: customer.email,
          fromGroupInnerId: customer.groupInnerId,
          fromGroupName: customer.groupName,
          toGroupInnerId,
          toGroupName: groupName,
          actorUserId: auth.userId,
          orgId: auth.activeOrganizationId!,
        });

        return {
          customer: {
            innerId: customer.innerId,
            email: customer.email,
            name: name || customer.email,
            groupInnerId: toGroupInnerId,
            groupName,
          },
        };
      },
    );

    return NextResponse.json({ ok: true, message: "Átrakva.", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    if (msg === "UNKNOWN_GROUP") {
      return NextResponse.json(
        {
          error:
            "Ismeretlen csoport. Frissítsd az oldalt, vagy ellenőrizd a Shoprentert.",
        },
        { status: 400 },
      );
    }
    if (msg === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { error: "A vevő nincs a boltból (törölve?)." },
        { status: 404 },
      );
    }
    console.error("[POST merchant/customers/move]", err);
    return NextResponse.json(
      { error: msg || "Átrakás sikertelen" },
      { status: 500 },
    );
  }
}
