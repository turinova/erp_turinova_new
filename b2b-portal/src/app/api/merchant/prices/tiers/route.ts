import { NextResponse } from "next/server";
import {
  isErrorResponse,
  requireMerchantApi,
} from "@/lib/auth/merchant-api";
import { replaceMirroredVolumeTiers } from "@/lib/commerce/volume-tier-mirror";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import {
  listVolumeTiersForProductGroup,
  replaceVolumeTiers,
} from "@/lib/shoprenter/product-specials";
import type { ShoprenterConfig } from "@/lib/shoprenter/api";

type LoadedShop = { shopId: string; config: ShoprenterConfig };

async function loadShop(
  organizationId: string,
  userId: string,
): Promise<LoadedShop | null> {
  return withTenant({ organizationId, userId }, async (client) => {
    const loaded = await loadMerchantShoprenterConfig(client, organizationId);
    return loaded;
  });
}

async function mirrorTiers(opts: {
  organizationId: string;
  userId: string;
  shopId: string;
  groupId: string;
  productInnerId: number;
  tiers: {
    minQty: number;
    priceNet: number;
    maxQty?: number | null;
    id?: string;
  }[];
}): Promise<void> {
  await withTenant(
    { organizationId: opts.organizationId, userId: opts.userId },
    async (client) => {
      await replaceMirroredVolumeTiers(client, {
        shopId: opts.shopId,
        customerGroupOuterId: opts.groupId,
        productInnerId: opts.productInnerId,
        tiers: opts.tiers.map((t) => ({
          minQty: Number(t.minQty),
          priceNet: Number(t.priceNet),
          maxQty: t.maxQty != null ? Number(t.maxQty) : null,
          srSpecialId: t.id ?? null,
        })),
      });
    },
  );
}

/**
 * GET /api/merchant/prices/tiers?groupId=&productInnerId=
 * SR olvasás a DB-tranzakción kívül; tükör külön rövid txn-ben.
 */
export async function GET(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const groupId = url.searchParams.get("groupId")?.trim() || "";
  const productInnerId = Number(url.searchParams.get("productInnerId"));
  if (!groupId || !Number.isFinite(productInnerId) || productInnerId < 1) {
    return NextResponse.json(
      { error: "groupId és productInnerId kell." },
      { status: 400 },
    );
  }

  try {
    const loaded = await loadShop(
      auth.activeOrganizationId!,
      auth.userId,
    );
    if (!loaded) {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs." },
        { status: 404 },
      );
    }

    const tiers = await listVolumeTiersForProductGroup(
      loaded.config,
      Math.round(productInnerId),
      groupId,
    );

    let mirrorOk = true;
    let mirrorError: string | null = null;
    try {
      await mirrorTiers({
        organizationId: auth.activeOrganizationId!,
        userId: auth.userId,
        shopId: loaded.shopId,
        groupId,
        productInnerId: Math.round(productInnerId),
        tiers,
      });
    } catch (e) {
      mirrorOk = false;
      mirrorError = e instanceof Error ? e.message : "mirror fail";
      console.error("[GET tiers] mirror heal failed:", mirrorError);
    }

    return NextResponse.json({
      ok: true,
      tiers,
      mirrorOk,
      ...(mirrorError ? { mirrorError } : {}),
    });
  } catch (err) {
    console.error("[GET merchant/prices/tiers]", err);
    const msg =
      err instanceof Error ? err.message : "Sávok betöltése sikertelen";
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PUT /api/merchant/prices/tiers
 * { groupId, productInnerId, tiers: [{ minQty, priceNet, maxQty? }] }
 * Üres tiers = törlés.
 */
export async function PUT(req: Request) {
  const auth = await requireMerchantApi();
  if (isErrorResponse(auth)) return auth;

  let body: {
    groupId?: string;
    productInnerId?: number;
    tiers?: unknown;
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

  const tiersRaw = Array.isArray(body.tiers) ? body.tiers : [];
  const tiers = tiersRaw
    .map((t) => {
      if (!t || typeof t !== "object") return null;
      const o = t as Record<string, unknown>;
      const minQty = Number(o.minQty);
      const priceNet = Number(o.priceNet);
      const maxQty =
        o.maxQty != null && o.maxQty !== "" ? Number(o.maxQty) : null;
      if (!Number.isFinite(minQty) || minQty < 1) return null;
      if (!Number.isFinite(priceNet) || priceNet < 0) return null;
      return {
        minQty: Math.round(minQty),
        priceNet: Math.round(priceNet),
        maxQty:
          maxQty != null && Number.isFinite(maxQty) && maxQty > 0
            ? Math.round(maxQty)
            : null,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t != null)
    .slice(0, 10);

  try {
    const loaded = await loadShop(
      auth.activeOrganizationId!,
      auth.userId,
    );
    if (!loaded) {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }

    const saved = await replaceVolumeTiers(loaded.config, {
      productInnerId: Math.round(productInnerId),
      customerGroupOuterId: groupId,
      tiers,
    });

    try {
      await mirrorTiers({
        organizationId: auth.activeOrganizationId!,
        userId: auth.userId,
        shopId: loaded.shopId,
        groupId,
        productInnerId: Math.round(productInnerId),
        tiers: saved,
      });
    } catch (e) {
      console.error("[PUT tiers] mirror write failed:", e);
      return NextResponse.json(
        {
          ok: true,
          tiers: saved,
          mirrorOk: false,
          message:
            tiers.length === 0
              ? "Sávok törölve SR-ben, de a lista-badge tükör nem frissült."
              : `${saved.length} sáv mentve SR-be; lista-badge tükör hiba — nyisd újra a panelt.`,
          mirrorError: e instanceof Error ? e.message : "mirror fail",
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      tiers: saved,
      mirrorOk: true,
      message:
        tiers.length === 0
          ? "Sávok törölve."
          : `${saved.length} sáv mentve.`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NO_SHOP_OR_CREDS") {
      return NextResponse.json(
        { error: "Nincs bolt vagy API kulcs" },
        { status: 404 },
      );
    }
    console.error("[PUT merchant/prices/tiers]", err);
    const status = msg.includes("429") ? 429 : 500;
    return NextResponse.json(
      { error: msg || "Sáv mentés sikertelen" },
      { status },
    );
  }
}
