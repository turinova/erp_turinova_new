"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ExitImpersonateButton } from "@/components/platform/ExitImpersonateButton";

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "widget" | "customers" | "reports" | "settings";
};

const NAV: NavItem[] = [
  { href: "/home", label: "Áttekintés", icon: "home" },
  { href: "/riport", label: "Riport", icon: "reports" },
  { href: "/vevok", label: "Vevők", icon: "customers" },
  { href: "/widget", label: "Gyors rendelés", icon: "widget" },
  { href: "/settings", label: "Beállítások", icon: "settings" },
];

const TITLES: Record<string, string> = {
  "/home": "Áttekintés",
  "/riport": "Riport",
  "/widget": "Gyors rendelés",
  "/vevok": "Vevők",
  "/settings": "Beállítások",
};

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

function NavIcon({
  name,
  className,
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  if (name === "settings") return <IconSettings className={className} />;
  if (name === "widget") return <IconWidget className={className} />;
  if (name === "customers") return <IconCustomers className={className} />;
  if (name === "reports") return <IconReports className={className} />;
  return <IconHome className={className} />;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MerchantShell({
  children,
  email,
  displayName,
  impersonatingOrgName,
}: {
  children: React.ReactNode;
  email?: string | null;
  displayName?: string | null;
  impersonatingOrgName?: string | null;
}) {
  const pathname = usePathname();
  const title =
    pathname.startsWith("/vevok/") && pathname !== "/vevok"
      ? "Vevő"
      : (TITLES[pathname] ??
        NAV.find((item) => isActive(pathname, item.href))?.label ??
        "Merchant");
  const fullBleed =
    pathname === "/widget" ||
    pathname.startsWith("/widget/") ||
    pathname === "/vevok" ||
    pathname.startsWith("/vevok/");

  const linkClass = (active: boolean) =>
    active
      ? "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-text bg-surface-2 px-3 text-[13px] font-semibold text-text"
      : "flex h-9 cursor-pointer items-center gap-2 border-l-2 border-transparent px-3 text-[13px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-text";

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
      <aside className="glass-side sticky top-0 hidden h-dvh w-[200px] shrink-0 flex-col md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-line-strong px-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-none bg-accent text-[11px] font-bold text-white">
            T
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">
              Turinova
            </p>
            <p className="truncate text-[11px] font-medium text-faint">Bolt</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 py-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(active)}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line-strong p-3">
          <p className="truncate text-[12px] font-semibold text-text">
            {displayName || email || "Te"}
          </p>
          <p className="truncate text-[11px] text-faint">{email ?? "—"}</p>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 px-4 md:px-6">
          <Link
            href="/home"
            className="flex items-center gap-1.5 md:hidden"
            aria-label="Turinova"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-none bg-accent text-[11px] font-bold text-white">
              T
            </span>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
            {title}
          </h1>
        </header>

        <div className="glass-bar flex gap-1 px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
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
