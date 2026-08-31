import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { countOrgActiveSkus, countProductCategoryLinks, replaceShopProductCategoryLinks, upsertCatalogCategories } from "@/lib/commerce/catalog";
import {
  countMirroredGroupPrices,
  deleteMirroredGroupPrice,
  ensureGroupPriceMirror,
  listManufacturersCached,
  mapMirroredPricesForInners,
  upsertMirroredGroupPrice,
} from "@/lib/commerce/group-price-mirror";
import {
  countMirroredTierProducts,
  mapTierCountsForInners,
} from "@/lib/commerce/volume-tier-mirror";
import {
  listCatalogCategories,
  listCatalogManufacturers,
  listCatalogPage,
} from "@/lib/commerce/lookup";
import { withTenant } from "@/lib/db";
import { effectiveNet, marginPercent, netToGross } from "@/lib/merchant/pricing-engine";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { resolveCustomerGroups } from "@/lib/merchant/customer-group-sync";
import {
  deleteGroupPrice,
  upsertGroupPrice,
} from "@/lib/shoprenter/group-prices";
import {
  fetchCategoriesMap,
  fetchProductCategoryLinks,
} from "@/lib/shoprenter/api";

/** Shop-level throttle: category name / link heal (SR) max 1× / 15 perc, kivéve resync=1. */
const categoryHealAt = new Map<string, number>();
const CATEGORY_HEAL_TTL_MS = 15 * 60 * 1000;

function parseInnerId(external: string): number | null {
  const t = external.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  try {
    const decoded = Buffer.from(t, "base64").toString("utf8");
    const m = decoded.match(/product_id=(\d+)/i);
    if (m) return Number(m[1]);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * GET /api/merchant/prices?groupId=&q=&page=&limit=&manufacturerInnerId=&resync=1&debug=1
 * Hot path: Postgres only (mirror + catalog). Groups a DB mapból.
 */
export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const groupId = url.searchParams.get("groupId")?.trim() || "";
  const q = url.searchParams.get("q")?.trim() || "";
  const page = Math.max(0, Number(url.searchParams.get("page") || 0) || 0);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || 50) || 50),
  );
  const mfrRaw = url.searchParams.get("manufacturerInnerId");
  const manufacturerInnerId =
    mfrRaw != null && mfrRaw !== ""
      ? Number(mfrRaw)
      : null;
  const mfrFilter =
    manufacturerInnerId != null &&
    Number.isFinite(manufacturerInnerId) &&
    manufacturerInnerId > 0
      ? Math.round(manufacturerInnerId)
      : null;
  const catRaw = url.searchParams.get("categoryInnerId");
  const categoryInnerId =
    catRaw != null && catRaw !== "" ? Number(catRaw) : null;
  const catFilter =
    categoryInnerId != null &&
    Number.isFinite(categoryInnerId) &&
    categoryInnerId > 0
      ? Math.round(categoryInnerId)
      : null;
  const forceResync =
    url.searchParams.get("resync") === "1" ||
    url.searchParams.get("resync") === "true";
  const debug =
    url.searchParams.get("debug") === "1" ||
    url.searchParams.get("debug") === "true";
  const ownOnly =
    url.searchParams.get("ownOnly") === "1" ||
    url.searchParams.get("ownOnly") === "true";
  const tiersOnly =
    url.searchParams.get("tiersOnly") === "1" ||
    url.searchParams.get("tiersOnly") === "true";

  if (!groupId) {
    return NextResponse.json(
      { error: "Válassz vevőcsoportot." },
      { status: 400 },
    );
  }

  const timing: Record<string, number> = {};
  const mark = (key: string, t0: number) => {
    timing[key] = Date.now() - t0;
  };

  try {
    const tAll = Date.now();
    const result = await withTenant(
      {
        organizationId: auth.activeOrganizationId,
        userId: auth.userId,
      },
      async (client) => {
        const t0 = Date.now();
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.activeOrganizationId!,
        );
        mark("loadConfig", t0);
        if (!loaded) return { error: "NO_SHOP_OR_CREDS" as const };

        const tGroups = Date.now();
        const groups = await resolveCustomerGroups(
          client,
          loaded.shopId,
          loaded.config,
          { forceSync: forceResync },
        );
        mark("listCustomerGroups", tGroups);
        const group = groups.find((g) => g.id === groupId);
        if (!group) {
          return { error: "GROUP_NOT_FOUND" as const };
        }

        const tSync = Date.now();
        const sync = await ensureGroupPriceMirror(
          client,
          loaded.config,
          loaded.shopId,
          groupId,
          { force: forceResync },
        );
        mark("ensureMirror", tSync);
        timing.mirrorSynced = sync.synced ? 1 : 0;
        timing.mirrorSkipped = sync.skipped ? 1 : 0;
        timing.mirrorRows = sync.rowCount;

        const tCatalog = Date.now();
        let [
          catalog,
          manufacturers,
          categories,
          catalogCount,
          ownPriceCount,
          tierProductCount,
        ] = await Promise.all([
            listCatalogPage(client, loaded.shopId, {
              page,
              limit,
              q,
              manufacturerInnerId: mfrFilter,
              categoryInnerId: catFilter,
              ownOnly,
              tiersOnly,
              customerGroupOuterId: groupId,
            }),
            listManufacturersCached(
              client,
              loaded.shopId,
              listCatalogManufacturers,
            ).catch(() => []),
            listCatalogCategories(client, loaded.shopId).catch(() => []),
            countOrgActiveSkus(client, auth.activeOrganizationId!),
            countMirroredGroupPrices(client, loaded.shopId, groupId),
            countMirroredTierProducts(client, loaded.shopId, groupId).catch(
              () => 0,
            ),
          ]);

        // Régi sync top-level name nélkül → "Kategória #id". Heal SR categoryExtend-ből.
        // Üres product_catalog_categories → termék↔kategória link heal.
        const placeholderN = categories.filter((c) =>
          /^Kategória #\d+$/i.test(c.name),
        ).length;
        const linkCount = await countProductCategoryLinks(
          client,
          loaded.shopId,
        ).catch(() => 0);
        const needNameHeal =
          categories.length > 0 &&
          placeholderN >= Math.max(1, Math.ceil(categories.length * 0.4));
        const needLinkHeal = categories.length > 0 && linkCount === 0;
        const lastHeal = categoryHealAt.get(loaded.shopId) ?? 0;
        const healFresh =
          forceResync || Date.now() - lastHeal > CATEGORY_HEAL_TTL_MS;
        if ((needNameHeal || needLinkHeal) && healFresh) {
          try {
            categoryHealAt.set(loaded.shopId, Date.now());
            if (needNameHeal) {
              const meta = await fetchCategoriesMap(loaded.config);
              if (meta.size) {
                await upsertCatalogCategories(client, loaded.shopId, [
                  ...meta.values(),
                ]);
                timing.categoryHeal = meta.size;
              }
            }
            if (needLinkHeal || forceResync) {
              const links = await fetchProductCategoryLinks(loaded.config);
              if (links.length) {
                const n = await replaceShopProductCategoryLinks(
                  client,
                  loaded.shopId,
                  links,
                );
                timing.categoryLinkHeal = n;
              }
            }
            categories = await listCatalogCategories(
              client,
              loaded.shopId,
            ).catch(() => categories);
            // Link heal után a kategória-szűrt oldal újraszámolása
            if ((needLinkHeal || forceResync) && catFilter != null) {
              catalog = await listCatalogPage(client, loaded.shopId, {
                page,
                limit,
                q,
                manufacturerInnerId: mfrFilter,
                categoryInnerId: catFilter,
                ownOnly,
                tiersOnly,
                customerGroupOuterId: groupId,
              });
            }
          } catch (e) {
            console.warn("[prices] category heal", e);
            categoryHealAt.set(loaded.shopId, Date.now());
          }
        }
        mark("catalogAndMeta", tCatalog);

        const innerIds = catalog.rows
          .map((r) => parseInnerId(r.external_product_id))
          .filter((n): n is number => n != null);

        const tPrices = Date.now();
        const priceByInner = await mapMirroredPricesForInners(
          client,
          loaded.shopId,
          groupId,
          innerIds,
        );
        mark("mapMirrorPrices", tPrices);

        const tTiers = Date.now();
        let tierByInner = new Map<
          number,
          { tierCount: number; tierSummary: string | null }
        >();
        try {
          tierByInner = await mapTierCountsForInners(
            client,
            loaded.shopId,
            groupId,
            innerIds,
          );
        } catch (e) {
          // 025 migration may not be applied yet
          console.warn("[prices] volume tier mirror", e);
        }
        mark("mapTierCounts", tTiers);

        const rows = catalog.rows.map((row) => {
          const productInnerId = parseInnerId(row.external_product_id);
          const listNet =
            row.list_price_net != null && row.list_price_net !== ""
              ? Number(row.list_price_net)
              : null;
          const costRaw =
            row.cost_net != null && row.cost_net !== ""
              ? Number(row.cost_net)
              : null;
          const costNet =
            costRaw != null && Number.isFinite(costRaw) && costRaw > 0
              ? Math.round(costRaw)
              : null;
          const own =
            productInnerId != null
              ? priceByInner.get(productInnerId)
              : undefined;
          const tierInfo =
            productInnerId != null
              ? tierByInner.get(productInnerId)
              : undefined;
          const list =
            listNet != null && Number.isFinite(listNet) ? listNet : 0;
          const eff = effectiveNet({
            listNet: list,
            groupPercent: group.percentDiscount,
            ownGroupNet: own?.priceNet ?? null,
            qty: 1,
          });
          const name = (row.name || "").trim() || null;
          const listRounded =
            listNet != null && Number.isFinite(listNet)
              ? Math.round(listNet)
              : null;
          const vatRate = 27;
          const discountNet =
            listRounded != null && eff.net < listRounded
              ? listRounded - eff.net
              : null;
          const discountPct =
            listRounded != null && listRounded > 0 && discountNet != null
              ? Math.round((discountNet / listRounded) * 1000) / 10
              : null;
          return {
            sku: row.sku,
            name,
            modelNumber: row.model_number,
            imageUrl: row.image_url?.trim() || null,
            manufacturerInnerId: row.manufacturer_inner_id ?? null,
            manufacturerName: row.manufacturer_name?.trim() || null,
            productInnerId,
            costNet,
            listPriceNet: listRounded,
            listPriceGross:
              listRounded != null ? netToGross(listRounded, vatRate) : null,
            groupPriceNet: own?.priceNet ?? null,
            groupPriceId: own?.srPriceId ?? null,
            tierCount: tierInfo?.tierCount ?? 0,
            tierSummary: tierInfo?.tierSummary ?? null,
            effectiveNet: eff.net,
            effectiveGross: netToGross(eff.net, vatRate),
            discountNet,
            discountPct,
            marginPct: marginPercent(eff.net, costNet),
            vatRate,
            priceSource: eff.source,
            active: row.active,
          };
        });

        return {
          group: {
            id: group.id,
            innerId: group.innerId,
            name: group.name,
            percentDiscount: group.percentDiscount,
            isDefault: group.isDefault,
          },
          rows,
          manufacturers,
          categories,
          manufacturerInnerId: mfrFilter,
          categoryInnerId: catFilter,
          page,
          pageCount: catalog.pageCount,
          total: catalog.total,
          ownPriceCount,
          tierProductCount,
          catalogCount,
          catalogEmpty: catalogCount === 0,
          ownOnly,
          tiersOnly,
          mirror: {
            synced: sync.synced,
            skipped: sync.skipped,
            rowCount: sync.rowCount,
            durationMs: sync.durationMs,
            error: sync.error ?? null,
          },
        };
      },
    );
    mark("total", tAll);

    if ("error" in result) {
      if (result.error === "NO_SHOP_OR_CREDS") {
        return NextResponse.json(
          {
            error:
              "Nincs bolt vagy API kulcs. Állítsd be a Beállításokban.",
          },
          { status: 404 },
        );
      }
      if (result.error === "GROUP_NOT_FOUND") {
        return NextResponse.json(
          { error: "Ismeretlen vevőcsoport." },
          { status: 404 },
        );
      }
    }

    const body: Record<string, unknown> = { ok: true, ...result };
    if (debug) body._timing = timing;
    if (timing.total != null) {
      console.info("[GET merchant/prices]", timing);
    }
    return NextResponse.json(body);
  } catch (err) {
    console.error("[GET merchant/prices]", err);
    const msg =
      err instanceof Error ? err.message : "Árak betöltése sikertelen";
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PUT /api/merchant/prices — SR write + local mirror write-through
 */
export async function PUT(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    groupId?: string;
    productInnerId?: number;
    priceNet?: number | null;
    groupPriceId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 });
  }

  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  const productInnerId = Number(body.productInnerId);
  if (!groupId || !Number.isFinite(productInnerId) || productInnerId < 1) {
    return NextResponse.json(
      { error: "groupId és productInnerId kell." },
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

        if (body.priceNet == null || Number.isNaN(Number(body.priceNet))) {
          if (body.groupPriceId) {
            await deleteGroupPrice(loaded.config, body.groupPriceId, {
              customerGroupOuterId: groupId,
            });
          } else {
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
            }
          }
          await deleteMirroredGroupPrice(client, {
            shopId: loaded.shopId,
            customerGroupOuterId: groupId,
            productInnerId,
          });
          return { cleared: true as const };
        }

        const priceNet = Number(body.priceNet);
        if (!Number.isFinite(priceNet) || priceNet < 0) {
          throw new Error("Érvénytelen ár.");
        }

        const saved = await upsertGroupPrice(loaded.config, {
          customerGroupOuterId: groupId,
          productInnerId,
          priceNet,
          existingId: body.groupPriceId ?? null,
        });
        await upsertMirroredGroupPrice(client, {
          shopId: loaded.shopId,
          customerGroupOuterId: groupId,
          productInnerId,
          priceNet: saved.priceNet,
          srPriceId: saved.id || null,
        });
        return { cleared: false as const, price: saved };
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      message: result.cleared
        ? "Saját ár törölve. Listaár / kedvezmény él."
        : "Kész. A vevő a gyors rendelésben ezt látja.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[PUT merchant/prices]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Mentés sikertelen" },
      { status },
    );
  }
}
