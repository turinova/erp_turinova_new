import type { PoolClient } from "pg";
import {
  countActivePartnersMonth,
  effectivePartnerLimit,
} from "@/lib/billing/active-partners";
import { PLAN_DEFAULTS, parsePlanId, type PlanId } from "@/lib/billing/plans";
import {
  UPGRADE_MAILTO,
  type PartnerGateDto,
} from "@/lib/billing/types";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { query } from "@/lib/db";
import { loadMerchantShop, type MerchantShopDto } from "@/lib/merchant/shop";

export type MerchantOverview = {
  plan: PlanId;
  planLabel: string;
  status: "trial" | "active" | "suspended";
  isTrial: boolean;
  trialDaysLeft: number | null;
  partnersUsed: number;
  partnersLimit: number;
  overCap: boolean;
  warn80: boolean;
  catalogStatus: string;
  catalogReady: boolean;
  productCount: number;
  progressPct: number;
  shop: MerchantShopDto | null;
  next: {
    title: string;
    body: string;
    href: string;
    cta: string;
    external: boolean;
  };
};

export async function listTopWidgetPartnerIds(
  client: PoolClient,
  organizationId: string,
  limit: number,
): Promise<number[]> {
  if (limit <= 0) return [];
  const res = await query<{ inner_id: number }>(
    client,
    `select o.sr_customer_inner_id as inner_id
     from b2b_orders o
     join shops s on s.id = o.shop_id
     where s.organization_id = $1
       and s.purged_at is null
       and o.source = 'widget'
       and o.status in ('recorded', 'linked')
       and o.sr_customer_inner_id is not null
       and o.created_at >= date_trunc('month', now())
     group by o.sr_customer_inner_id
     order by count(*) desc, o.sr_customer_inner_id
     limit $2`,
    [organizationId, limit],
  );
  return res.rows.map((r) => Number(r.inner_id));
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function loadPartnerGate(
  client: PoolClient,
  orgId: string,
): Promise<PartnerGateDto> {
  const orgRes = await query<{
    status: "trial" | "active" | "suspended";
    plan: string;
    trial_ends_at: string | null;
  }>(
    client,
    `select status, plan, trial_ends_at from organizations where id = $1`,
    [orgId],
  );
  const org = orgRes.rows[0];
  const plan = parsePlanId(org?.plan ?? "start");
  const status = org?.status ?? "trial";
  const trialActive =
    status === "trial" &&
    org?.trial_ends_at != null &&
    new Date(org.trial_ends_at).getTime() > Date.now();

  const [activePartners, partnerLimit] = await Promise.all([
    countActivePartnersMonth(client, orgId),
    effectivePartnerLimit(client, orgId),
  ]);
  const overCap = activePartners > partnerLimit;
  const visibleInnerIds = overCap
    ? await listTopWidgetPartnerIds(client, orgId, partnerLimit)
    : [];

  return {
    activePartners,
    partnerLimit,
    overCap,
    warn80: partnerLimit > 0 && activePartners / partnerLimit >= 0.8,
    visibleInnerIds,
    plan,
    planLabel: PLAN_DEFAULTS[plan]?.label ?? plan,
    isTrial: trialActive,
    trialDaysLeft: trialActive ? daysLeft(org?.trial_ends_at ?? null) : null,
  };
}

export async function loadMerchantOverview(
  client: PoolClient,
  orgId: string,
): Promise<MerchantOverview> {
  const gate = await loadPartnerGate(client, orgId);
  const orgRes = await query<{
    status: "trial" | "active" | "suspended";
  }>(client, `select status from organizations where id = $1`, [orgId]);
  const status = orgRes.rows[0]?.status ?? "trial";
  const trialExpired = status === "trial" && !gate.isTrial;

  const shop = await loadMerchantShop(client, orgId);
  const cat = shop
    ? await query<{
        catalog_status: string;
        catalog_product_count: number;
      }>(
        client,
        `select catalog_status, catalog_product_count from shops where id = $1`,
        [shop.shopId],
      )
    : null;
  const catalogStatus = cat?.rows[0]?.catalog_status ?? "pending";
  const productCount = cat?.rows[0]?.catalog_product_count ?? 0;
  const job = shop
    ? await query<{ pages_done: number; pages_total: number | null }>(
        client,
        `select pages_done, pages_total from sync_jobs
         where shop_id = $1 order by created_at desc limit 1`,
        [shop.shopId],
      )
    : null;
  const pagesDone = job?.rows[0]?.pages_done ?? 0;
  const pagesTotal = job?.rows[0]?.pages_total;
  const progressPct =
    catalogStatus === "ready"
      ? 100
      : pagesTotal && pagesTotal > 0
        ? Math.min(99, Math.round((pagesDone / pagesTotal) * 100))
        : 0;

  let next: MerchantOverview["next"];
  if (!shop || !shop.hasCredentials) {
    next = {
      title: "Kapcsold össze a boltot",
      body: "Írd be a Shoprenter jelszót a Beállításokban, aztán nyomd meg: Működik?",
      href: "/settings",
      cta: "Beállítások",
      external: false,
    };
  } else if (shop.lastPingOk === false) {
    next = {
      title: "A bolt nem válaszol",
      body: "A jelszó vagy a cím hibás lehet. Nézd meg a Beállításokat.",
      href: "/settings",
      cta: "Beállítások",
      external: false,
    };
  } else if (!catalogIsSearchable(catalogStatus)) {
    next = {
      title: "Még másoljuk a termékeket",
      body:
        progressPct > 0
          ? `Kb. ${progressPct}% kész. Utána a kereső a boltban működik.`
          : "Ez eltarthat pár percig. Addig a gyors rendelésben még nincs teljes lista.",
      href: "/settings",
      cta: "Megnézem",
      external: false,
    };
  } else if (!shop.widgetEnabled) {
    next = {
      title: "A gyors rendelés ki van kapcsolva",
      body: "Kapcsold be a boltban, hogy a partnerek cikkszámra rendelhessenek.",
      href: "/widget",
      cta: "Gyors rendelés bekapcsolása",
      external: false,
    };
  } else if (gate.overCap) {
    next = {
      title: "Elfogyott a hely a csomagban",
      body: `Ebben a hónapban ${gate.activePartners} vevő rendelt a gyors rendeléssel. A csomag ${gate.partnerLimit} vevőt bír. A többi vevő adatai el vannak rejtve — a gyors rendelés ettől még megy.`,
      href: "/vevok",
      cta: "Vevők",
      external: false,
    };
  } else if (trialExpired) {
    next = {
      title: "Lejárt a próba",
      body: "Írj a Turinovának, és válassz csomagot, hogy a gyors rendelés tovább menjen.",
      href: UPGRADE_MAILTO,
      cta: "Írj a Turinovának",
      external: true,
    };
  } else {
    const store = shop.storeUrl;
    next = {
      title: "Kész a beállítás",
      body: "Nyisd meg a boltod, lépj be vevőként, és próbáld a gyors rendelést.",
      href: store || "/widget",
      cta: store ? "Bolt megnyitása" : "Gyors rendelés",
      external: Boolean(store),
    };
  }

  return {
    plan: gate.plan as PlanId,
    planLabel: gate.planLabel,
    status,
    isTrial: gate.isTrial,
    trialDaysLeft: gate.trialDaysLeft,
    partnersUsed: gate.activePartners,
    partnersLimit: gate.partnerLimit,
    overCap: gate.overCap,
    warn80: gate.warn80,
    catalogStatus,
    catalogReady: catalogIsSearchable(catalogStatus),
    productCount,
    progressPct,
    shop,
    next,
  };
}
