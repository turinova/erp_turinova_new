import type { PoolClient } from "pg";
import {
  countActivePartnersMonth,
  effectivePartnerLimit,
} from "@/lib/billing/active-partners";
import { PLAN_DEFAULTS, formatPlanPrice, onPlan, parsePlanId, type PlanId } from "@/lib/billing/plans";
import { type PartnerGateDto } from "@/lib/billing/types";
import { catalogIsSearchable } from "@/lib/commerce/lookup";
import { query } from "@/lib/db";
import { loadMerchantShop, type MerchantShopDto } from "@/lib/merchant/shop";

export type SetupStepId =
  | "shop"
  | "catalog"
  | "widget"
  | "pricing";

export type SetupStep = {
  id: SetupStepId;
  label: string;
  done: boolean;
  href: string;
};

export type MerchantOverview = {
  plan: PlanId;
  planLabel: string;
  status: "trial" | "active" | "suspended";
  isTrial: boolean;
  trialExpired: boolean;
  trialDaysLeft: number | null;
  trialEndsAt: string | null;
  partnersUsed: number;
  partnersLimit: number;
  paidPartnerLimit: number;
  overCap: boolean;
  warn80: boolean;
  wouldLoseOnPaid: boolean;
  catalogStatus: string;
  catalogReady: boolean;
  productCount: number;
  progressPct: number;
  /** Widget-sourced B2B orders this calendar month. */
  widgetOrdersMonth: number;
  hasPricing: boolean;
  setup: SetupStep[];
  setupComplete: boolean;
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
  const paidPartnerLimit = PLAN_DEFAULTS[plan].partnerLimit;
  const trialExpired =
    status === "trial" &&
    !trialActive;
  const warnBasis = trialActive ? paidPartnerLimit : partnerLimit;
  const overCap = activePartners > partnerLimit;
  const wouldLoseOnPaid = trialActive && activePartners > paidPartnerLimit;
  const visibleInnerIds = overCap
    ? await listTopWidgetPartnerIds(client, orgId, partnerLimit)
    : [];
  const paidVisibleInnerIds = wouldLoseOnPaid
    ? await listTopWidgetPartnerIds(client, orgId, paidPartnerLimit)
    : [];

  return {
    activePartners,
    partnerLimit,
    paidPartnerLimit,
    overCap,
    warn80: warnBasis > 0 && activePartners / warnBasis >= 0.8,
    wouldLoseOnPaid,
    visibleInnerIds,
    paidVisibleInnerIds,
    plan,
    planLabel: PLAN_DEFAULTS[plan]?.label ?? plan,
    isTrial: trialActive,
    trialExpired,
    trialDaysLeft: trialActive ? daysLeft(org?.trial_ends_at ?? null) : null,
    trialEndsAt: org?.trial_ends_at ?? null,
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

  const catalogReady = catalogIsSearchable(catalogStatus);
  const shopConnected = Boolean(
    shop?.hasCredentials && shop.lastPingOk !== false,
  );
  const widgetOn = Boolean(shop?.widgetEnabled);

  let hasPricing = false;
  let widgetOrdersMonth = 0;
  if (shop) {
    try {
      const priceRes = await query<{ n: string }>(
        client,
        `select (
           (select count(*)::int from partner_group_prices where shop_id = $1) +
           (select count(*)::int from partner_volume_tiers where shop_id = $1)
         )::text as n`,
        [shop.shopId],
      );
      hasPricing = Number(priceRes.rows[0]?.n ?? 0) > 0;
    } catch {
      hasPricing = false;
    }
    try {
      const ordRes = await query<{ n: string }>(
        client,
        `select count(*)::text as n
         from b2b_orders
         where shop_id = $1
           and source = 'widget'
           and status in ('recorded', 'linked')
           and created_at >= date_trunc('month', now())`,
        [shop.shopId],
      );
      widgetOrdersMonth = Number(ordRes.rows[0]?.n ?? 0);
    } catch {
      widgetOrdersMonth = 0;
    }
  }

  const setup: SetupStep[] = [
    {
      id: "shop",
      label: "Bolt összekötve",
      done: shopConnected,
      href: "/settings",
    },
    {
      id: "catalog",
      label: "Termékek szinkronban",
      done: catalogReady,
      href: "/settings",
    },
    {
      id: "widget",
      label: "Widget bekapcsolva",
      done: widgetOn,
      href: "/widget",
    },
    {
      id: "pricing",
      label: "Partnerár vagy sáv",
      done: hasPricing,
      href: "/arak",
    },
  ];
  const setupComplete = setup.every((s) => s.done);

  let next: MerchantOverview["next"];
  if (!shop || !shop.hasCredentials) {
    next = {
      title: "Kapcsold össze a boltot",
      body: "Írd be a Shoprenter API-nevet és jelszót, aztán: Működik?",
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
  } else if (!catalogReady) {
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
  } else if (!hasPricing) {
    next = {
      title: "Állíts be partnerárat",
      body: "Csoportár vagy mennyiségi sáv. Így látják a viszonteladók a saját árukat.",
      href: "/arak",
      cta: "Árazás",
      external: false,
    };
  } else if (gate.overCap) {
    next = {
      title: "Elfogyott a hely a csomagban",
      body: `Ebben a hónapban ${gate.activePartners} vevő rendelt a gyors rendeléssel. A csomagba ${gate.partnerLimit} fér. A többi vevő adatait itt nem látod. A gyors rendelés ettől még megy.`,
      href: "/csomag",
      cta: `Tartsd a ${gate.activePartners} vevőt`,
      external: false,
    };
  } else if (gate.trialExpired) {
    next = {
      title: "Lejárt a próba",
      body: `A boltban a gyors rendelés megy. Itt ${gate.paidPartnerLimit} vevőig látsz mindent. Plus: ${formatPlanPrice(PLAN_DEFAULTS.plus.listPriceHuf)}.`,
      href: "/csomag",
      cta: `Tartsd a ${gate.activePartners} vevőt · Plus`,
      external: false,
    };
  } else if (gate.isTrial && gate.trialDaysLeft != null && gate.trialDaysLeft <= 7) {
    next = {
      title: `A próba ${gate.trialDaysLeft} nap múlva lejár`,
      body:
        gate.wouldLoseOnPaid
          ? `Ebben a hónapban ${gate.activePartners} vevő rendelt. ${onPlan(gate.planLabel)} ${gate.paidPartnerLimit}-ig látod őket.`
          : "A gyors rendelés a boltban marad. A csomag azt szabja meg, hány vevőt látsz itt.",
      href: "/csomag",
      cta: `Tartsd a ${gate.activePartners} vevőt`,
      external: false,
    };
  } else {
    const store = shop.storeUrl;
    next = {
      title: "A bolt kész",
      body: "Nézd meg vevőként, hogy megy-e a gyors rendelés.",
      href: store || "/widget",
      cta: store ? "Bolt megnyitása" : "Gyors rendelés",
      external: Boolean(store),
    };
  }

  return {
    plan: gate.plan,
    planLabel: gate.planLabel,
    status,
    isTrial: gate.isTrial,
    trialExpired: gate.trialExpired,
    trialDaysLeft: gate.trialDaysLeft,
    trialEndsAt: gate.trialEndsAt,
    partnersUsed: gate.activePartners,
    partnersLimit: gate.partnerLimit,
    paidPartnerLimit: gate.paidPartnerLimit,
    overCap: gate.overCap,
    warn80: gate.warn80,
    wouldLoseOnPaid: gate.wouldLoseOnPaid,
    catalogStatus,
    catalogReady,
    productCount,
    progressPct,
    widgetOrdersMonth,
    hasPricing,
    setup,
    setupComplete,
    shop,
    next,
  };
}
