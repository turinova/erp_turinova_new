import { NextResponse } from "next/server";
import {
  kickBootstrapWorkers,
  startShopBootstrap,
} from "@/lib/commerce/bootstrap";
import { withTenant } from "@/lib/db";
import { loadMerchantShoprenterConfig } from "@/lib/merchant/customer-group-map";
import { resolveEmbedSessionFromRequest } from "@/lib/shoprenter/embed-session";
import { findEmbedShopById } from "@/lib/shoprenter/embed-shop";

async function requireEmbed(req: Request) {
  const session = await resolveEmbedSessionFromRequest(req);
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Nincs embed session — nyisd meg az appot a Shoprenterből" },
        { status: 401 },
      ),
    } as const;
  }
  const shop = await findEmbedShopById(session.shopId);
  if (!shop || shop.status === "uninstalled") {
    return {
      error: NextResponse.json(
        { error: "A bolt nincs összekötve vagy el lett távolítva" },
        { status: 404 },
      ),
    } as const;
  }
  return { session, shop } as const;
}

/** POST — force full catalog sync from Shoprenter (embed Bolt UI). */
export async function POST(req: Request) {
  const auth = await requireEmbed(req);
  if ("error" in auth) return auth.error;

  if (!auth.shop.hasCredentials) {
    return NextResponse.json(
      { error: "Nincs API kapcsolat. Nyisd meg újra az appot a Shoprenterből." },
      { status: 400 },
    );
  }
  if (auth.shop.status === "needs_reauth") {
    return NextResponse.json(
      { error: "Shop újrahitelesítés kell — nyisd meg újra az appot." },
      { status: 409 },
    );
  }

  try {
    const result = await withTenant(
      {
        organizationId: auth.session.organizationId,
        userId: null,
        isPlatformAdmin: true,
      },
      async (client) => {
        const loaded = await loadMerchantShoprenterConfig(
          client,
          auth.session.organizationId,
        );
        if (!loaded) return { error: "NO_CREDS" as const };
        const enq = await startShopBootstrap(
          client,
          auth.shop.shopId,
          auth.session.organizationId,
          loaded.config,
          { force: true },
        );
        return { jobId: enq.catalogJobId };
      },
    );

    if ("error" in result) {
      return NextResponse.json(
        { error: "Előbb mentsd / állítsd helyre az API kapcsolatot" },
        { status: 400 },
      );
    }

    kickBootstrapWorkers();
    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      catalogStatus: "pending",
    });
  } catch (err) {
    console.error("[POST shoprenter/embed/catalog/resync]", err);
    return NextResponse.json({ error: "Szinkron indítás sikertelen" }, { status: 500 });
  }
}
