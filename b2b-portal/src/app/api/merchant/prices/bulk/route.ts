import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import {
  deleteMirroredGroupPrice,
  upsertMirroredGroupPrice,
} from "@/lib/commerce/group-price-mirror";
import {
  listProductInnersByCategory,
  listProductInnersByManufacturer,
} from "@/lib/commerce/lookup";
import { query, withTenant } from "@/lib/db";
import { percentOffList, costPlusNet } from "@/lib/merchant/pricing-engine";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  deleteGroupPrice,
  upsertGroupPrice,
} from "@/lib/shoprenter/group-prices";

const BULK_ID_CAP = 200;

/**
 * POST /api/merchant/prices/bulk
 * {
 *   groupId,
 *   productInnerIds?: number[],
 *   manufacturerInnerId?: number,
 *   categoryInnerId?: number,
 *   op: "set"|"percent_off_list"|"cost_plus"|"clear",
 *   value?: number
 * }
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    groupId?: string;
    productInnerIds?: unknown;
    manufacturerInnerId?: unknown;
    categoryInnerId?: unknown;
    op?: string;
    value?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  const op = body.op;
  if (!groupId || !op) {
    return NextResponse.json(
      { error: "groupId és op kell." },
      { status: 400 },
    );
  }
  if (op !== "set" && op !== "percent_off_list" && op !== "cost_plus" && op !== "clear") {
    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }

  let ids = Array.isArray(body.productInnerIds)
    ? body.productInnerIds
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, BULK_ID_CAP)
    : [];

  const mfrRaw = Number(body.manufacturerInnerId);
  const manufacturerInnerId =
    Number.isFinite(mfrRaw) && mfrRaw > 0 ? Math.round(mfrRaw) : null;
  const catRaw = Number(body.categoryInnerId);
  const categoryInnerId =
    Number.isFinite(catRaw) && catRaw > 0 ? Math.round(catRaw) : null;

  if (
    !ids.length &&
    manufacturerInnerId == null &&
    categoryInnerId == null
  ) {
    return NextResponse.json(
      { error: "Válassz ki terméket, kategóriát vagy márkát." },
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

        let truncated = false;
        if (!ids.length && categoryInnerId != null) {
          const resolved = await listProductInnersByCategory(
            client,
            loaded.shopId,
            categoryInnerId,
            BULK_ID_CAP + 1,
            true,
          );
          if (resolved.length > BULK_ID_CAP) {
            truncated = true;
            ids = resolved.slice(0, BULK_ID_CAP);
          } else {
            ids = resolved;
          }
        } else if (!ids.length && manufacturerInnerId != null) {
          const resolved = await listProductInnersByManufacturer(
            client,
            loaded.shopId,
            manufacturerInnerId,
            BULK_ID_CAP + 1,
          );
          if (resolved.length > BULK_ID_CAP) {
            truncated = true;
            ids = resolved.slice(0, BULK_ID_CAP);
          } else {
            ids = resolved;
          }
        }

        if (!ids.length) {
          throw new Error("NO_PRODUCTS_IN_SCOPE");
        }

        // list / cost from catalog
        const listByInner = new Map<number, number>();
        const costByInner = new Map<number, number>();
        if (op === "percent_off_list" || op === "cost_plus") {
          const res = await query<{
            external_product_id: string;
            list_price_net: string | null;
            cost_net: string | null;
          }>(
            client,
            `select external_product_id, list_price_net::text, cost_net::text
             from product_catalog
             where shop_id = $1
               and external_product_id = any($2::text[])`,
            [loaded.shopId, ids.map(String)],
          );
          for (const row of res.rows) {
            const inner = Number(row.external_product_id);
            if (!Number.isFinite(inner)) continue;
            const list =
              row.list_price_net != null ? Number(row.list_price_net) : NaN;
            if (Number.isFinite(list)) listByInner.set(inner, list);
            const cost =
              row.cost_net != null ? Number(row.cost_net) : NaN;
            if (Number.isFinite(cost) && cost > 0) {
              costByInner.set(inner, cost);
            }
          }
        }

        let updated = 0;
        let cleared = 0;
        const errors: { productInnerId: number; message: string }[] = [];

        for (const productInnerId of ids) {
          try {
            if (op === "clear") {
              const { findGroupPrice, productOuterIdFromInner } = await import(
                "@/lib/shoprenter/group-prices"
              );
              const found = await findGroupPrice(
                loaded.config,
                groupId,
                productOuterIdFromInner(productInnerId),
              );
              if (found) {
                await deleteGroupPrice(loaded.config, found.id, {
                  customerGroupOuterId: groupId,
                });
                cleared++;
              }
              await deleteMirroredGroupPrice(client, {
                shopId: loaded.shopId,
                customerGroupOuterId: groupId,
                productInnerId,
              });
              continue;
            }

            let priceNet: number;
            if (op === "set") {
              const v = Number(body.value);
              if (!Number.isFinite(v) || v < 0) {
                errors.push({
                  productInnerId,
                  message: "Érvénytelen ár",
                });
                continue;
              }
              priceNet = Math.round(v);
            } else if (op === "cost_plus") {
              const cost = costByInner.get(productInnerId);
              if (cost == null) {
                errors.push({
                  productInnerId,
                  message: "Nincs beszerzési ár",
                });
                continue;
              }
              const pct = Number(body.value);
              if (!Number.isFinite(pct) || pct < 0) {
                errors.push({
                  productInnerId,
                  message: "Érvénytelen árrés %",
                });
                continue;
              }
              const suggested = costPlusNet(cost, pct);
              if (suggested == null) {
                errors.push({
                  productInnerId,
                  message: "Nincs beszerzési ár",
                });
                continue;
              }
              priceNet = suggested;
            } else {
              const list = listByInner.get(productInnerId);
              if (list == null) {
                errors.push({
                  productInnerId,
                  message: "Nincs listaár a katalógusban",
                });
                continue;
              }
              const pct = Number(body.value);
              if (!Number.isFinite(pct)) {
                errors.push({
                  productInnerId,
                  message: "Érvénytelen százalék",
                });
                continue;
              }
              priceNet = percentOffList(list, pct);
            }

            const saved = await upsertGroupPrice(loaded.config, {
              customerGroupOuterId: groupId,
              productInnerId,
              priceNet,
            });
            await upsertMirroredGroupPrice(client, {
              shopId: loaded.shopId,
              customerGroupOuterId: groupId,
              productInnerId,
              priceNet: saved.priceNet,
              srPriceId: saved.id || null,
            });
            updated++;
            // gentle pacing vs 429
            await new Promise((r) => setTimeout(r, 120));
          } catch (e) {
            errors.push({
              productInnerId,
              message: e instanceof Error ? e.message : "Hiba",
            });
          }
        }

        return { updated, cleared, errors, truncated, scoped: ids.length };
      },
    );

    const truncNote = result.truncated
      ? ` (max ${BULK_ID_CAP} termék / kérés)`
      : "";
    return NextResponse.json({
      ok: true,
      ...result,
      message: `Kész. ${result.updated} ár frissült${result.cleared ? `, ${result.cleared} törölve` : ""}${truncNote}.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    if (msg === "NO_PRODUCTS_IN_SCOPE") {
      return NextResponse.json(
        {
          error:
            "Nincs termék a szűrésben. Futtass katalógus szinkront, vagy válassz más kategóriát/márkát.",
        },
        { status: 400 },
      );
    }
    console.error("[POST merchant/prices/bulk]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Tömeges mentés sikertelen" },
      { status },
    );
  }
}
