import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import {
  listProductInnersByCategory,
  listProductInnersByManufacturer,
} from "@/lib/commerce/lookup";
import { replaceMirroredVolumeTiers } from "@/lib/commerce/volume-tier-mirror";
import { query, withTenant } from "@/lib/db";
import { percentOffList } from "@/lib/merchant/pricing-engine";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { replaceVolumeTiers } from "@/lib/shoprenter/product-specials";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";

/** SR rate limit — sáv bulk lassú (termékenként több API hívás). */
const BULK_ID_CAP = 40;

type TierIn = {
  minQty: number;
  priceNet: number | null;
  percentOffList: number | null;
};

/**
 * POST /api/merchant/prices/tiers/bulk
 * SR hívások a DB-tranzakción kívül; tükör termékenként külön short txn.
 */
export async function POST(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    groupId?: string;
    productInnerIds?: unknown;
    manufacturerInnerId?: unknown;
    categoryInnerId?: unknown;
    tiers?: unknown;
    clear?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  if (!groupId) {
    return NextResponse.json({ error: "groupId kell." }, { status: 400 });
  }

  const clear = body.clear === true || body.clear === 1 || body.clear === "1";

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

  const tiersRaw = Array.isArray(body.tiers) ? body.tiers : [];
  const tierSpecs: TierIn[] = clear
    ? []
    : tiersRaw
        .map((t) => {
          if (!t || typeof t !== "object") return null;
          const o = t as Record<string, unknown>;
          const minQty = Number(o.minQty);
          if (!Number.isFinite(minQty) || minQty < 1) return null;
          const priceNet =
            o.priceNet != null && o.priceNet !== ""
              ? Number(o.priceNet)
              : null;
          const pctOff =
            o.percentOffList != null && o.percentOffList !== ""
              ? Number(o.percentOffList)
              : null;
          const hasAbs =
            priceNet != null && Number.isFinite(priceNet) && priceNet >= 0;
          const hasPct =
            pctOff != null &&
            Number.isFinite(pctOff) &&
            pctOff > 0 &&
            pctOff < 100;
          if (!hasAbs && !hasPct) return null;
          return {
            minQty: Math.round(minQty),
            priceNet: hasAbs ? Math.round(priceNet!) : null,
            percentOffList: hasPct ? pctOff : null,
          };
        })
        .filter((t): t is TierIn => t != null)
        .slice(0, 8);

  if (!clear && tierSpecs.length === 0) {
    return NextResponse.json(
      { error: "Adj meg legalább egy sávot (db + Ft vagy −%), vagy clear." },
      { status: 400 },
    );
  }

  try {
    const prep = await withTenant(
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

        let resolved = ids;
        if (!resolved.length && categoryInnerId != null) {
          resolved = await listProductInnersByCategory(
            client,
            loaded.shopId,
            categoryInnerId,
            BULK_ID_CAP,
            true,
          );
        }
        if (!resolved.length && manufacturerInnerId != null) {
          resolved = await listProductInnersByManufacturer(
            client,
            loaded.shopId,
            manufacturerInnerId,
            BULK_ID_CAP,
          );
        }
        if (!resolved.length) {
          return { error: "NO_IDS" as const };
        }

        const needsList = tierSpecs.some(
          (t) => t.percentOffList != null && t.priceNet == null,
        );
        const listByInner = new Map<number, number>();
        if (needsList) {
          const priceRes = await query<{
            external_product_id: string;
            list_price_net: string | null;
          }>(
            client,
            `select external_product_id, list_price_net::text
             from product_catalog
             where shop_id = $1
               and external_product_id = any($2::text[])`,
            [loaded.shopId, resolved.map(String)],
          );
          for (const r of priceRes.rows) {
            const id = Number(r.external_product_id);
            const list =
              r.list_price_net != null ? Number(r.list_price_net) : NaN;
            if (Number.isFinite(id) && Number.isFinite(list) && list > 0) {
              listByInner.set(id, list);
            }
          }
        }

        return {
          ok: true as const,
          shopId: loaded.shopId,
          config: loaded.config as ShoprenterConfig,
          ids: resolved,
          listByInner: Object.fromEntries(listByInner),
        };
      },
    );

    if ("error" in prep) {
      if (prep.error === "NO_SHOP_OR_CREDS") {
        return NextResponse.json(
          { error: "Nincs bolt vagy API kulcs." },
          { status: 404 },
        );
      }
      if (prep.error === "NO_IDS") {
        return NextResponse.json(
          { error: "Nincs termék a kijelölésben / szűrőben." },
          { status: 400 },
        );
      }
    }

    if (!("ok" in prep) || !prep.ok) {
      return NextResponse.json({ error: "Bulk előkészítés sikertelen" }, { status: 500 });
    }

    const listByInner = new Map<number, number>(
      Object.entries(prep.listByInner).map(([k, v]) => [Number(k), v]),
    );

    let ok = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const productInnerId of prep.ids) {
      try {
        const tiers = clear
          ? []
          : tierSpecs.map((t) => {
              if (t.priceNet != null) {
                return { minQty: t.minQty, priceNet: t.priceNet };
              }
              const list = listByInner.get(productInnerId) ?? 0;
              const net = percentOffList(list, t.percentOffList ?? 0);
              if (net == null) {
                throw new Error("Nincs listaár a −%-hoz");
              }
              return { minQty: t.minQty, priceNet: net };
            });

        const saved = await replaceVolumeTiers(prep.config, {
          productInnerId,
          customerGroupOuterId: groupId,
          tiers,
        });

        await withTenant(
          {
            organizationId: auth.activeOrganizationId,
            userId: auth.userId,
          },
          async (client) => {
            await replaceMirroredVolumeTiers(client, {
              shopId: prep.shopId,
              customerGroupOuterId: groupId,
              productInnerId,
              tiers: saved.map((t) => ({
                minQty: t.minQty,
                priceNet: t.priceNet,
                maxQty: t.maxQty,
                srSpecialId: t.id,
              })),
            });
          },
        );

        ok++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : "hiba";
        if (errors.length < 5) errors.push(`#${productInnerId}: ${msg}`);
      }
    }

    return NextResponse.json({
      ok: true,
      processed: prep.ids.length,
      succeeded: ok,
      failed,
      errors,
      capped: prep.ids.length >= BULK_ID_CAP,
    });
  } catch (err) {
    console.error("[POST merchant/prices/tiers/bulk]", err);
    const msg = err instanceof Error ? err.message : "Sáv bulk sikertelen";
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
