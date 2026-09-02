import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { withTenant } from "@/lib/db";
import { buildPartnerBehavior } from "@/lib/merchant/customer-behavior";
import {
  countCustomerOrderFacts,
  customerDetailUseFactsEnabled,
  fingerprintIsFresh,
  getShopCustomerFingerprint,
  listCustomerOrdersFromFacts,
  orderFactsTableExists,
} from "@/lib/merchant/customer-detail-from-db";
import { buildMerchantCustomerStats } from "@/lib/merchant/customer-stats";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { resolveCustomerGroups } from "@/lib/merchant/customer-group-sync";
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
  type SrAddress,
  type SrCustomer,
} from "@/lib/shoprenter/customers";
import {
  listCustomerOrders,
  type CustomerOrderSummary,
} from "@/lib/shoprenter";

type Ctx = { params: Promise<{ id: string }> };

function mapAddresses(addresses: SrAddress[]) {
  return addresses.map((a) => ({
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
  }));
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const { id: rawId } = await ctx.params;
  const customerInnerId = Number(rawId);
  if (!Number.isFinite(customerInnerId) || customerInnerId <= 0) {
    return NextResponse.json({ error: "Érvénytelen vevő" }, { status: 400 });
  }

  const url = new URL(req.url);
  const forceLive =
    url.searchParams.get("live") === "1" ||
    url.searchParams.get("resync") === "1";
  const wantAddresses = url.searchParams.get("addresses") !== "0";

  // Schema ensure OUTSIDE tenant transaction (own connection).
  await ensurePartnerGroupRulesSchema().catch((err) => {
    console.warn("[customer detail] schema ensure", err);
  });

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

        const srGroups = await resolveCustomerGroups(
          client,
          loaded.shopId,
          loaded.config,
        );
        const defaultIds = new Set(
          srGroups.filter((g) => g.isDefault).map((g) => g.innerId),
        );

        const useFacts =
          customerDetailUseFactsEnabled() &&
          (await orderFactsTableExists(client));

        let fingerprint = await getShopCustomerFingerprint(
          client,
          loaded.shopId,
          customerInnerId,
        );

        let customer: SrCustomer | null = null;
        let customerSource: "db" | "shoprenter" | "mixed" = "db";
        let warnings: string[] = [];

        const needLiveCustomer =
          forceLive || !fingerprintIsFresh(fingerprint) || !fingerprint?.email;

        if (needLiveCustomer) {
          try {
            customer = await getCustomerByInnerId(
              loaded.config,
              customerInnerId,
              { groups: srGroups },
            );
            if (customer) {
              customerSource = fingerprint ? "mixed" : "shoprenter";
              const name =
                [customer.lastname, customer.firstname]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || customer.email;
              await upsertShopCustomer(client, {
                shopId: loaded.shopId,
                srCustomerInnerId: customer.innerId,
                srCustomerId: customer.id,
                email: customer.email,
                nameSnapshot: name,
                phoneSnapshot: customer.telephone,
                srGroupInnerId: customer.groupInnerId,
                srGroupNameSnapshot: customer.groupName,
                srStatus: "active",
                approved: customer.approved,
                dateCreatedSr: customer.dateCreated,
              });
              fingerprint = await getShopCustomerFingerprint(
                client,
                loaded.shopId,
                customerInnerId,
              );
            }
          } catch (err) {
            console.warn("[customer detail] live customer", err);
            warnings.push(
              err instanceof Error
                ? `Shoprenter vevő: ${err.message}`
                : "Shoprenter vevő betöltése sikertelen",
            );
          }
        }

        if (!customer && fingerprint?.email) {
          const groupInnerId = fingerprint.sr_group_inner_id;
          const snap = (fingerprint.name_snapshot || "").trim();
          const parts = snap ? snap.split(/\s+/) : [];
          const lastname = parts.length > 1 ? parts[0]! : snap || fingerprint.email;
          const firstname = parts.length > 1 ? parts.slice(1).join(" ") : "";
          customer = {
            id:
              fingerprint.sr_customer_id ||
              `inner:${fingerprint.sr_customer_inner_id}`,
            innerId: fingerprint.sr_customer_inner_id,
            email: fingerprint.email,
            firstname,
            lastname,
            telephone: fingerprint.phone_snapshot,
            approved: fingerprint.approved ?? true,
            status: fingerprint.sr_status,
            dateCreated: fingerprint.date_created_sr,
            groupInnerId,
            groupName: fingerprint.sr_group_name_snapshot,
            groupId: null,
          };
          customerSource = "db";
        }

        if (!customer) {
          return { error: "CUSTOMER_NOT_FOUND" as const };
        }

        // Orders: DB-first from shop_order_facts
        let orderPage: { orders: CustomerOrderSummary[]; pageCount: number } = {
          orders: [],
          pageCount: 1,
        };
        let ordersSource: "db" | "shoprenter" | "empty" = "empty";

        if (useFacts) {
          const factCount = await countCustomerOrderFacts(
            client,
            loaded.shopId,
            customerInnerId,
          );
          if (factCount > 0) {
            orderPage = await listCustomerOrdersFromFacts(
              client,
              loaded.shopId,
              customerInnerId,
              { limit: 50 },
            );
            ordersSource = "db";
          }
        }

        if (ordersSource === "empty" && (forceLive || !useFacts)) {
          try {
            orderPage = await listCustomerOrders(
              loaded.config,
              customer.innerId,
              { limit: 25, page: 0, email: customer.email },
            );
            ordersSource = orderPage.orders.length ? "shoprenter" : "empty";
          } catch (err) {
            console.warn("[customer detail] orders", err);
            warnings.push(
              err instanceof Error
                ? `Rendelések: ${err.message}`
                : "Rendelések betöltése sikertelen",
            );
            orderPage = { orders: [], pageCount: 1 };
          }
        } else if (ordersSource === "empty" && useFacts) {
          // Facts on but none for this customer — soft live fallback once
          try {
            orderPage = await listCustomerOrders(
              loaded.config,
              customer.innerId,
              { limit: 25, page: 0, email: customer.email },
            );
            ordersSource = orderPage.orders.length ? "shoprenter" : "empty";
          } catch (err) {
            console.warn("[customer detail] orders fallback", err);
            warnings.push(
              "Nincs még syncelt rendelés; az élő Shoprenter lekérés sem sikerült.",
            );
          }
        }

        // Addresses: optional, short-fail — never block the page
        let addresses: SrAddress[] = [];
        if (wantAddresses && (forceLive || customerSource !== "db")) {
          try {
            addresses = await listAddressesForCustomer(
              loaded.config,
              customer.id,
            );
          } catch (err) {
            console.warn("[customer detail] addresses", err);
            warnings.push("Címek betöltése sikertelen (Shoprenter).");
          }
        }

        const taxFromAddress =
          addresses.find((a) => a.taxNumber)?.taxNumber ??
          fingerprint?.tax_number_snapshot ??
          null;
        const company =
          addresses.find((a) => a.company)?.company ??
          fingerprint?.company_snapshot ??
          null;
        const name =
          [customer.lastname, customer.firstname]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          fingerprint?.name_snapshot ||
          customer.email;

        const ref = await upsertShopCustomer(client, {
          shopId: loaded.shopId,
          srCustomerInnerId: customer.innerId,
          srCustomerId: customer.id,
          email: customer.email,
          nameSnapshot: name,
          phoneSnapshot: customer.telephone,
          taxNumberSnapshot: taxFromAddress,
          companySnapshot: company,
          srGroupInnerId: customer.groupInnerId,
          srGroupNameSnapshot: customer.groupName,
          srStatus: "active",
          approved: customer.approved,
          dateCreatedSr: customer.dateCreated,
        });

        // Sequential queries on the same PoolClient (pg forbids parallel).
        const moves = await listGroupMovesForCustomer(
          client,
          loaded.shopId,
          customer.innerId,
          40,
        );
        const widgetOrders = await listWidgetOrdersForCustomer(
          client,
          loaded.shopId,
          customer.innerId,
        );
        let skipAuto = false;
        try {
          skipAuto = await getSkipAutoGroupMove(
            client,
            loaded.shopId,
            customer.innerId,
          );
        } catch {
          skipAuto = false;
        }

        const isDefaultGroup =
          customer.groupInnerId != null &&
          defaultIds.has(customer.groupInnerId);
        const isPartner =
          customer.groupInnerId != null && !isDefaultGroup;

        const stats = buildMerchantCustomerStats(orderPage.orders);
        const behavior = buildPartnerBehavior(orderPage.orders);

        const movesAsc = [...moves].reverse();
        const ordersWithGroup = orderPage.orders.map((o) => {
          const t = Date.parse(o.dateCreated) || 0;
          const g = groupAtTimeFromMoves(movesAsc, t, {
            innerId: customer!.groupInnerId,
            name: customer!.groupName,
          });
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
          meta: {
            customerSource,
            ordersSource,
            useFacts,
            warnings,
          },
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
          addresses: mapAddresses(addresses),
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
    const msg =
      err instanceof Error ? err.message : "Vevő betöltése sikertelen";
    const status =
      msg.includes("429") || msg.includes("Request Limit")
        ? 429
        : msg.includes("timeout")
          ? 504
          : 500;
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
