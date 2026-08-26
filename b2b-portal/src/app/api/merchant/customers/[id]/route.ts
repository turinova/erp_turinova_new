import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { buildPartnerBehavior } from "@/lib/merchant/customer-behavior";
import { buildMerchantCustomerStats } from "@/lib/merchant/customer-stats";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  listGroupMovesForCustomer,
  listWidgetOrdersForCustomer,
  getSkipAutoGroupMove,
  setSkipAutoGroupMove,
  upsertShopCustomer,
} from "@/lib/merchant/shop-customers";
import { groupAtTimeFromMoves } from "@/lib/merchant/partner-progress";
import { ensurePartnerGroupRulesSchema } from "@/lib/merchant/ensure-group-rules-schema";
import {
  getCustomerByInnerId,
  listAddressesForCustomer,
  listCustomerGroups,
} from "@/lib/shoprenter/customers";
import { listCustomerOrders } from "@/lib/shoprenter";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
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

        const srGroups = await listCustomerGroups(loaded.config);
        const customer = await getCustomerByInnerId(
          loaded.config,
          customerInnerId,
          { groups: srGroups },
        );
        if (!customer) return { error: "CUSTOMER_NOT_FOUND" as const };

        const defaultIds = new Set(
          srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
        );
        const isDefaultGroup =
          customer.groupInnerId != null &&
          defaultIds.has(customer.groupInnerId);
        const isPartner =
          customer.groupInnerId != null && !isDefaultGroup;

        // Címek + rendelések párhuzamosan (groups már cache-ből jön)
        const [addresses, orderPage] = await Promise.all([
          listAddressesForCustomer(loaded.config, customer.id).catch(
            (err) => {
              console.warn("[customer detail] addresses", err);
              return [];
            },
          ),
          listCustomerOrders(loaded.config, customer.innerId, {
            limit: 25,
            page: 0,
          }).catch((err) => {
            console.warn("[customer detail] orders", err);
            return { orders: [], pageCount: 1 };
          }),
        ]);

        const taxFromAddress =
          addresses.find((a) => a.taxNumber)?.taxNumber ?? null;
        const company =
          addresses.find((a) => a.company)?.company ?? null;
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
          taxNumberSnapshot: taxFromAddress,
          srGroupInnerId: customer.groupInnerId,
          srGroupNameSnapshot: customer.groupName,
          srStatus: "active",
        });

        await ensurePartnerGroupRulesSchema();
        const [moves, widgetOrders, skipAuto] = await Promise.all([
          listGroupMovesForCustomer(client, loaded.shopId, customer.innerId, 40),
          listWidgetOrdersForCustomer(
            client,
            loaded.shopId,
            customer.innerId,
          ),
          getSkipAutoGroupMove(client, loaded.shopId, customer.innerId).catch(
            () => false,
          ),
        ]);

        const stats = buildMerchantCustomerStats(orderPage.orders);
        const behavior = buildPartnerBehavior(orderPage.orders);

        const movesAsc = [...moves].reverse();
        const ordersWithGroup = orderPage.orders.map((o) => {
          const t = Date.parse(o.dateCreated) || 0;
          const g = groupAtTimeFromMoves(
            movesAsc,
            t,
            {
              innerId: customer.groupInnerId,
              name: customer.groupName,
            },
          );
          return {
            id: o.id,
            innerId: o.innerId,
            dateLabel: o.dateLabel,
            dateCreated: o.dateCreated,
            totalFormatted: o.totalFormatted,
            total: o.total,
            status: o.status,
            groupInnerId: g.innerId,
            groupName: g.name,
          };
        });

        return {
          shopId: loaded.shopId,
          fingerprintId: ref.id,
          customer: {
            id: customer.id,
            innerId: customer.innerId,
            email: customer.email,
            firstname: customer.firstname,
            lastname: customer.lastname,
            name,
            telephone: customer.telephone,
            approved: customer.approved,
            status: customer.status,
            dateCreated: customer.dateCreated,
            groupInnerId: customer.groupInnerId,
            groupName: customer.groupName,
            isDefaultGroup,
            isPartner,
            company,
            taxNumber: taxFromAddress,
            skipAutoGroupMove: skipAuto,
          },
          addresses: addresses.map((a) => ({
            id: a.id,
            firstname: a.firstname,
            lastname: a.lastname,
            company: a.company,
            taxNumber: a.taxNumber,
            address1: a.address1,
            address2: a.address2,
            postcode: a.postcode,
            city: a.city,
            country: a.country,
            zone: a.zone,
            telephone: a.telephone,
            type: a.type,
          })),
          stats,
          behavior,
          orders: orderPage.orders,
          ordersWithGroup,
          orderPageCount: orderPage.pageCount,
          widgetOrders: widgetOrders.map((w) => ({
            id: w.id,
            grossTotal: w.gross_total != null ? Number(w.gross_total) : null,
            netTotal: w.net_total != null ? Number(w.net_total) : null,
            lineCount: w.line_count,
            source: w.source,
            status: w.status,
            createdAt: w.created_at,
          })),
          moves: moves.map((m) => ({
            id: m.id,
            fromGroupInnerId: m.from_group_inner_id,
            fromGroupName: m.from_group_name,
            toGroupInnerId: m.to_group_inner_id,
            toGroupName: m.to_group_name,
            reason: m.reason ?? null,
            source: m.source ?? "manual",
            metric: m.metric ?? null,
            metricValue:
              m.metric_value != null ? Number(m.metric_value) : null,
            threshold: m.threshold != null ? Number(m.threshold) : null,
            period: m.period ?? null,
            direction: m.direction ?? null,
            createdAt: m.created_at,
          })),
          groups: srGroups.map((g) => ({
            innerId: g.innerId,
            groupId: g.id,
            name: g.name,
            isDefault: g.isDefault,
          })),
        };
      },
    );

    if ("error" in result) {
      if (result.error === "NO_SHOP_OR_CREDS") {
        return NextResponse.json(
          { error: "Nincs bolt vagy API kulcs" },
          { status: 404 },
        );
      }
      if (result.error === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json(
          { error: "A vevő nincs a boltból (törölve?)." },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[GET merchant/customers/:id]", err);
    const msg = err instanceof Error ? err.message : "Vevő betöltése sikertelen";
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  let body: { skipAutoGroupMove?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }
  if (typeof body.skipAutoGroupMove !== "boolean") {
    return NextResponse.json(
      { error: "skipAutoGroupMove (true/false) kötelező" },
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

        await upsertShopCustomer(client, {
          shopId: loaded.shopId,
          srCustomerInnerId: customerInnerId,
          srStatus: "active",
        });
        const skip = await setSkipAutoGroupMove(
          client,
          loaded.shopId,
          customerInnerId,
          body.skipAutoGroupMove!,
        );
        return { skipAutoGroupMove: skip };
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      message: result.skipAutoGroupMove
        ? "Az automata nem nyúl ehhez a vevőhöz."
        : "Az automata újra kezelheti ezt a vevőt.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[PATCH merchant/customers/:id]", err);
    return NextResponse.json(
      { error: msg || "Mentés sikertelen" },
      { status: 500 },
    );
  }
}
