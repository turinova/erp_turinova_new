"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { TurinovaWordmark } from "@/components/brand/TurinovaWordmark";
import { ExitImpersonateButton } from "@/components/platform/ExitImpersonateButton";

type NavChild = { href: string; label: string };

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "widget" | "customers" | "reports" | "settings" | "plans" | "prices" | "levelup";
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { href: "/home", label: "Áttekintés", icon: "home" },
  { href: "/riport", label: "Riport", icon: "reports" },
  { href: "/vevok", label: "Vevők", icon: "customers" },
  { href: "/szintlepes", label: "Szintlépés", icon: "levelup" },
  {
    href: "/arak",
    label: "Árak",
    icon: "prices",
    children: [
      { href: "/arak", label: "Árazás" },
      { href: "/arak/utmutato", label: "Útmutató" },
    ],
  },
  { href: "/widget", label: "Gyors rendelés", icon: "widget" },
  { href: "/csomag", label: "Csomagok", icon: "plans" },
  { href: "/settings", label: "Beállítások", icon: "settings" },
];

const TITLES: Record<string, string> = {
  "/home": "Áttekintés",
  "/riport": "Riport",
  "/widget": "Gyors rendelés",
  "/vevok": "Vevők",
  "/szintlepes": "Szintlépés",
  "/arak": "Árazás",
  "/arak/utmutato": "Útmutató",
  "/settings": "Beállítások",
  "/csomag": "Csomagok",
};

const NAV_COLLAPSED_KEY = "tn-merchant-nav-collapsed";

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconWidget({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconCustomers({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPlans({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v18" />
      <rect x="3" y="6" width="18" height="4" rx="0" />
      <rect x="3" y="14" width="18" height="4" rx="0" />
    </svg>
  );
}

function IconPrices({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconLevelUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconReports({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3v18h18" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-9" />
    </svg>
  );
}

function IconCollapse({
  collapsed,
  className,
}: {
  collapsed: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {collapsed ? (
        <>
          <rect x="3" y="3" width="18" height="18" />
          <path d="M9 3v18" />
          <path d="m14 9 3 3-3 3" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="18" height="18" />
          <path d="M9 3v18" />
          <path d="m15 15-3-3 3-3" />
        </>
      )}
    </svg>
  );
}

function NavIcon({
  name,
  className,
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  if (name === "settings") return <IconSettings className={className} />;
  if (name === "plans") return <IconPlans className={className} />;
  if (name === "widget") return <IconWidget className={className} />;
  if (name === "customers") return <IconCustomers className={className} />;
  if (name === "reports") return <IconReports className={className} />;
  if (name === "prices") return <IconPrices className={className} />;
  if (name === "levelup") return <IconLevelUp className={className} />;
  return <IconHome className={className} />;
}

function shortHuDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Exact path match (Árazás vs Útmutató children). */
function isExactActive(pathname: string, href: string) {
  return pathname === href;
}

export function MerchantShell({
  children,
  email,
  displayName,
  impersonatingOrgName,
  trialChip,
}: {
  children: React.ReactNode;
  email?: string | null;
  displayName?: string | null;
  impersonatingOrgName?: string | null;
  trialChip?: {
    daysLeft: number | null;
    expired: boolean;
    planLabel?: string;
    trialEndsAt?: string | null;
  } | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const title =
    pathname.startsWith("/vevok/") && pathname !== "/vevok"
      ? "Vevő"
      : (TITLES[pathname] ??
        NAV.find((item) => isActive(pathname, item.href))?.label ??
        "Áttekintés");
  // Guide is padded content; only the price editor is full-bleed.
  const fullBleed =
    pathname === "/widget" ||
    pathname.startsWith("/widget/") ||
    pathname === "/vevok" ||
    pathname.startsWith("/vevok/") ||
    pathname === "/arak";

  const chipDate = shortHuDate(trialChip?.trialEndsAt);
  const linkClass = (active: boolean) =>
    collapsed
      ? active
        ? "flex h-9 w-full cursor-pointer items-center justify-center border-l-2 border-text bg-surface-2 text-text"
        : "flex h-9 w-full cursor-pointer items-center justify-center border-l-2 border-transparent text-faint transition-colors hover:bg-surface-2 hover:text-text"
      : active
        ? "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-text bg-surface-2 px-3 text-[13px] font-semibold text-text"
        : "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-transparent px-3 text-[13px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-text";
  const childLinkClass = (active: boolean) =>
    active
      ? "flex h-8 cursor-pointer items-center border-l-2 border-text bg-surface-2 py-0 pl-9 pr-3 text-[12px] font-semibold text-text"
      : "flex h-8 cursor-pointer items-center border-l-2 border-transparent py-0 pl-9 pr-3 text-[12px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-text";

  const mobileItems: { href: string; label: string }[] = [];
  for (const item of NAV) {
    if (item.children?.length) {
      for (const c of item.children) mobileItems.push(c);
    } else {
      mobileItems.push({ href: item.href, label: item.label });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {impersonatingOrgName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-text bg-surface px-4 py-2">
          <p className="text-[13px] font-semibold">
            Most {impersonatingOrgName} boltját nézed
          </p>
          <ExitImpersonateButton />
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1">
      <aside
        className={
          collapsed
            ? "glass-side sticky top-0 hidden h-dvh w-14 shrink-0 flex-col md:flex"
            : "glass-side sticky top-0 hidden h-dvh w-[200px] shrink-0 flex-col md:flex"
        }
      >
        <div
          className={
            collapsed
              ? "flex h-14 flex-col items-center justify-center gap-1 border-b border-line-strong px-1"
              : "flex h-14 items-center justify-between gap-1 border-b border-line-strong px-2"
          }
        >
          <Link
            href="/home"
            className={
              collapsed
                ? "flex items-center justify-center"
                : "flex min-w-0 flex-1 items-center"
            }
            aria-label="Turinova"
            title="Turinova"
          >
            {collapsed ? (
              <TurinovaWordmark variant="icon" height={22} />
            ) : (
              <TurinovaWordmark
                height={24}
                className="w-full max-w-full object-contain object-left"
              />
            )}
          </Link>
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border border-line-strong bg-surface text-faint hover:bg-surface-2 hover:text-text"
              aria-label="Menü összecsukása"
              title="Menü összecsukása"
            >
              <IconCollapse collapsed={false} />
            </button>
          ) : null}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 py-2">
          {NAV.map((item) => {
            const parentActive = isActive(pathname, item.href);
            const hasChildren = Boolean(item.children?.length);
            if (collapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(parentActive)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <NavIcon name={item.icon} />
                </Link>
              );
            }
            return (
              <div key={item.href}>
                {hasChildren ? (
                  <div
                    className={
                      parentActive
                        ? "flex h-9 items-center gap-2 border-l-2 border-text bg-surface-2 px-3 text-[13px] font-semibold text-text"
                        : "flex h-9 items-center gap-2 border-l-2 border-transparent px-3 text-[13px] font-medium text-faint"
                    }
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </div>
                ) : (
                  <Link href={item.href} className={linkClass(parentActive)}>
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                )}
                {hasChildren
                  ? item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={childLinkClass(
                          isExactActive(pathname, child.href),
                        )}
                      >
                        {child.label}
                      </Link>
                    ))
                  : null}
              </div>
            );
          })}
        </nav>
        <div
          className={
            collapsed
              ? "flex flex-col items-center gap-2 border-t border-line-strong p-2"
              : "border-t border-line-strong p-3"
          }
        >
          {collapsed ? (
            <>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center border border-line-strong bg-surface text-faint hover:bg-surface-2 hover:text-text"
                aria-label="Menü kinyitása"
                title="Menü kinyitása"
              >
                <IconCollapse collapsed />
              </button>
              <LogoutButton compact />
            </>
          ) : (
            <>
              <p className="truncate text-[12px] font-semibold text-text">
                {displayName || email || "Te"}
              </p>
              <p className="truncate text-[11px] text-faint">{email ?? "—"}</p>
              <LogoutButton />
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 px-4 md:px-6">
          <Link
            href="/home"
            className="flex items-center gap-1.5 md:hidden"
            aria-label="Turinova"
          >
            <TurinovaWordmark variant="icon" height={22} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
            {title}
          </h1>
          {pathname === "/arak" ? (
            <Link
              href="/arak/utmutato"
              className="shrink-0 cursor-pointer text-[12px] font-semibold text-faint hover:text-text"
            >
              Útmutató
            </Link>
          ) : null}
          {trialChip ? (
            <Link
              href="/csomag"
              className={
                trialChip.expired || (trialChip.daysLeft != null && trialChip.daysLeft <= 3)
                  ? "inline-flex shrink-0 border-2 border-warn px-2 py-1 text-[11px] font-bold"
                  : trialChip.daysLeft != null && trialChip.daysLeft <= 7
                    ? "inline-flex shrink-0 border-2 border-text px-2 py-1 text-[11px] font-bold"
                    : "inline-flex shrink-0 border border-line-strong px-2 py-1 text-[11px] font-semibold text-faint"
              }
            >
              {trialChip.expired
                ? `A próba lejárt · ${trialChip.planLabel ?? "Start"}`
                : trialChip.daysLeft === 0
                  ? `Ma lejár${chipDate ? ` · ${chipDate}` : ""}`
                  : trialChip.daysLeft === 1
                    ? `Holnap lejár${chipDate ? ` · ${chipDate}` : ""}`
                    : trialChip.daysLeft != null && trialChip.daysLeft <= 3
                      ? `${trialChip.daysLeft} nap múlva lejár`
                      : `Próba · ${trialChip.daysLeft} nap van hátra`}
            </Link>
          ) : null}
        </header>

        <div className="glass-bar flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
          {mobileItems.map((item) => {
            const active = isExactActive(pathname, item.href)
              ? true
              : item.href !== "/arak" && isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-none bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
                    : "rounded-none px-3 py-1.5 text-[12px] font-medium text-faint"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <main
          className={
            fullBleed
              ? "flex w-full min-h-0 flex-1 flex-col md:min-h-0 lg:h-[calc(100dvh-3rem)] lg:max-h-[calc(100dvh-3rem)]"
              : "w-full flex-1 px-4 py-6 md:px-8 md:py-8 lg:px-10"
          }
        >
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
