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

type MoveOk = {
  innerId: number;
  email: string;
  name: string;
  groupInnerId: number;
  groupName: string;
};

type MoveFail = { innerId: number; error: string };

/**
 * POST /api/merchant/customers/bulk-move
 * body: { customerInnerIds: number[], toGroupInnerId: number }
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: { customerInnerIds?: unknown; toGroupInnerId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const toGroupInnerId = Number(body.toGroupInnerId);
  if (!Number.isFinite(toGroupInnerId)) {
    return NextResponse.json(
      { error: "Válaszd ki, melyik csoportba kerüljenek." },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.customerInnerIds)
    ? [
        ...new Set(
          body.customerInnerIds
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ]
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Pipálj ki legalább egy vevőt." },
      { status: 400 },
    );
  }
  if (ids.length > 50) {
    return NextResponse.json(
      { error: "Egyszerre max 50 vevőt rakhatsz át." },
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
          target?.sr_name_snapshot ||
          srTarget?.name ||
          `Csoport ${toGroupInnerId}`;
        if (!groupOuterId) throw new Error("UNKNOWN_GROUP");

        const moved: MoveOk[] = [];
        const failed: MoveFail[] = [];

        for (const customerInnerId of ids) {
          try {
            const customer = await getCustomerByInnerId(
              loaded.config,
              customerInnerId,
            );
            if (!customer) {
              failed.push({
                innerId: customerInnerId,
                error: "Nincs a boltból",
              });
              continue;
            }

            await updateCustomerGroup(
              loaded.config,
              customer.id,
              groupOuterId,
            );

            const name =
              [customer.lastname, customer.firstname]
                .filter(Boolean)
                .join(" ")
                .trim() || customer.email;

            const ref = await upsertShopCustomer(client, {
              shopId: loaded.shopId,
              srCustomerInnerId: customer.innerId,
              srCustomerId: customer.id,
              email: customer.email,
              nameSnapshot: name,
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

            moved.push({
              innerId: customer.innerId,
              email: customer.email,
              name,
              groupInnerId: toGroupInnerId,
              groupName,
            });
          } catch (e) {
            failed.push({
              innerId: customerInnerId,
              error: e instanceof Error ? e.message : "hiba",
            });
          }
        }

        return { moved, failed, groupName };
      },
    );

    const ok = result.moved.length;
    const fail = result.failed.length;
    const message =
      fail === 0
        ? `${ok} vevő átkerült ide: ${result.groupName}`
        : `${ok} sikerült, ${fail} nem — nézd a listát.`;

    return NextResponse.json({ ok: true, message, ...result });
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
    console.error("[POST merchant/customers/bulk-move]", err);
    return NextResponse.json(
      { error: msg || "Átrakás sikertelen" },
      { status: 500 },
    );
  }
}
