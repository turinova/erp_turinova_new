import type { Metadata } from "next";
import Link from "next/link";
import {
  NearLimitBanner,
  UpgradeBanner,
  TrialWouldLoseBanner,
} from "@/components/merchant/PartnerUsageBar";
import { requireMerchant } from "@/lib/auth/require";
import { withTenant } from "@/lib/db";
import { loadMerchantOverview } from "@/lib/merchant/overview";

export const metadata: Metadata = {
  title: "Áttekintés",
};

const QUICK_LINKS = [
  { href: "/arak", label: "Árazás" },
  { href: "/widget", label: "Widget" },
  { href: "/vevok", label: "Vevők" },
  { href: "/riport", label: "Riport" },
] as const;

function CheckMark({ done }: { done: boolean }) {
  return (
    <span
      className={
        done
          ? "flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-accent text-white"
          : "flex h-5 w-5 shrink-0 items-center justify-center border border-line-strong bg-surface text-faint"
      }
      aria-hidden
    >
      {done ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.5L5 9L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="square"
          />
        </svg>
      ) : null}
    </span>
  );
}

export default async function MerchantHomePage() {
  const session = await requireMerchant();
  const orgId = session.activeOrganizationId!;
  const overview = await withTenant(
    { organizationId: orgId, userId: session.userId },
    (client) => loadMerchantOverview(client, orgId),
  );

  const shopTitle = overview.shop?.shoprenterShopName ?? "Még nincs bolt";
  const next = overview.next;
  const showFomo =
    overview.trialExpired ||
    (overview.isTrial &&
      overview.trialDaysLeft != null &&
      overview.trialDaysLeft <= 7);

  const showMetrics =
    overview.shop?.hasCredentials &&
    (overview.catalogReady ||
      overview.partnersUsed > 0 ||
      overview.widgetOrdersMonth > 0);

  const setupDoneCount = overview.setup.filter((s) => s.done).length;

  return (
    <div className="mx-auto w-full max-w-[920px]">
      <p className="mb-6 text-[13px] text-faint">{shopTitle}</p>

      {/* Next action */}
      <section className="tn-section">
        <p className="tn-label">Következő lépés</p>
        <h2 className="tn-section-title mt-1">{next.title}</h2>
        <p className="tn-section-sub">{next.body}</p>
        {next.external ? (
          <a
            href={next.href}
            target="_blank"
            rel="noopener noreferrer"
            className="tn-btn tn-btn-primary mt-5 inline-flex cursor-pointer"
          >
            {next.cta}
          </a>
        ) : (
          <Link
            href={next.href}
            className="tn-btn tn-btn-primary mt-5 inline-flex cursor-pointer"
          >
            {next.cta}
          </Link>
        )}
      </section>

      {/* Setup checklist */}
      <section className="tn-section mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="tn-label">Beállítás</p>
          <p className="text-[12px] text-faint">
            {setupDoneCount}/{overview.setup.length}
            {overview.setupComplete ? " · kész" : ""}
          </p>
        </div>
        <ul className="mt-3 divide-y divide-line border border-line-strong">
          {overview.setup.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2"
              >
                <CheckMark done={step.done} />
                <span
                  className={
                    step.done
                      ? "text-[13px] text-faint line-through"
                      : "text-[13px] font-medium text-text"
                  }
                >
                  {step.label}
                </span>
                {!step.done ? (
                  <span className="ml-auto text-[12px] text-accent">Nyitás</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Mini metrics — only when there is something to show */}
      {showMetrics ? (
        <section className="tn-section mt-8">
          <p className="tn-label">Ez a hónap</p>
          <div className="mt-3 grid grid-cols-1 gap-px border border-line-strong bg-line-strong sm:grid-cols-3">
            <div className="bg-surface px-4 py-3">
              <p className="text-[11px] text-faint">Aktív partnerek</p>
              <p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">
                {overview.partnersUsed}
                <span className="text-[13px] font-normal text-faint">
                  {" "}
                  / {overview.partnersLimit}
                </span>
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-[11px] text-faint">Widget rendelések</p>
              <p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">
                {overview.widgetOrdersMonth}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-[11px] text-faint">Termékek</p>
              <p className="mt-1 text-[20px] font-semibold tracking-tight tabular-nums">
                {overview.catalogReady ? overview.productCount : "—"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Quick links */}
      <section className="tn-section mt-8">
        <p className="tn-label">Gyors linkek</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="tn-btn tn-btn-ghost cursor-pointer"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>

      {overview.overCap ? (
        <div className="mt-6">
          <UpgradeBanner
            used={overview.partnersUsed}
            limit={overview.partnersLimit}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : overview.wouldLoseOnPaid && showFomo ? (
        <div className="mt-6">
          <TrialWouldLoseBanner
            used={overview.partnersUsed}
            paidLimit={overview.paidPartnerLimit}
            planLabel={overview.planLabel}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : overview.warn80 && !overview.isTrial ? (
        <div className="mt-6">
          <NearLimitBanner
            used={overview.partnersUsed}
            limit={overview.partnersLimit}
            shopName={overview.shop?.shoprenterShopName}
          />
        </div>
      ) : null}
    </div>
  );
}
